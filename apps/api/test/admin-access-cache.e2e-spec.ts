/**
 * E2E: Discord sync events clear the cached admin access.
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`) and Redis: every test
 * primes the admin access cache first and asserts the entry is there, so a
 * missing Redis fails the suite instead of passing on the database fallback.
 * The sync handlers are called with minimal stand-ins for discord.js objects.
 */
import { INestApplication } from '@nestjs/common';
import { Collection } from 'discord.js';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import {
  AdminContext,
  MemberContext,
  clearAllTables,
  closeTestDb,
  getTestDb,
  seedAdminContext,
  seedNonRootMember,
  TestDb,
} from './helpers/db';
import { disableNock, enableNock } from './helpers/discord-mock';
import { roles, serverMemberRoles } from '../src/database/entities';
import { PermissionCacheService } from '../src/modules/permissions/permission-cache.service';
import { MemberSyncService } from '../src/modules/sync/services/member-sync.service';
import { RoleSyncService } from '../src/modules/sync/services/role-sync.service';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('admin access cache and Discord sync events (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let root: AdminContext;
  let dev: MemberContext;
  let cache: PermissionCacheService;
  let members: MemberSyncService;
  let roleSync: RoleSyncService;

  const extraRoleId = '700000000000000009';

  beforeAll(async () => {
    enableNock();
    db = getTestDb();
    app = await createTestApp();
    cache = app.get(PermissionCacheService);
    members = app.get(MemberSyncService);
    roleSync = app.get(RoleSyncService);
  });

  afterAll(async () => {
    disableNock();
    await closeTestDb();
    await app.close();
  });

  beforeEach(async () => {
    await clearAllTables(db);
    await cache.clear();
    root = await seedAdminContext(db);
    dev = await seedNonRootMember(db, root.serverId);
    await db.insert(roles).values({
      id: extraRoleId,
      serverId: root.serverId,
      name: 'Extra',
      color: 0,
      hoist: false,
      position: 3,
      managed: false,
      mentionable: false,
    });
  });

  const as = (token: string) => `Bearer ${token}`;
  const http = () => request(app.getHttpServer());

  const grantSettingsRead = (roleId: string) =>
    http()
      .put(`/api/admin/access/roles/${roleId}`)
      .set('Authorization', as(root.bearerToken))
      .send({ grants: { settings: 'read' } })
      .expect(200);

  /** A request that primes the cache, then proof that it is cached. */
  const prime = async (expected: 200 | 403) => {
    await http()
      .get('/api/admin/settings')
      .set('Authorization', as(dev.bearerToken))
      .expect(expected);
    expect(await cache.getAdminAccess(dev.memberId)).not.toBeNull();
  };

  const settings = (expected: 200 | 403) =>
    http()
      .get('/api/admin/settings')
      .set('Authorization', as(dev.bearerToken))
      .expect(expected);

  const guildMember = (roleIds: string[]) =>
    ({
      id: dev.memberId,
      nickname: null,
      joinedAt: new Date(),
      guild: { id: root.serverId },
      user: {
        id: dev.memberId,
        username: 'member2',
        globalName: 'Member 2',
        avatar: null,
        avatarURL: () => null,
      },
      roles: {
        cache: new Collection(roleIds.map((id) => [id, { id }])),
      },
    }) as any;

  it('applies a role gained or lost in the main server on the next request', async () => {
    await grantSettingsRead(extraRoleId);

    await prime(403);
    await members.handleMemberUpdate(
      guildMember([dev.roleId]),
      guildMember([dev.roleId, extraRoleId]),
    );
    expect(await cache.getAdminAccess(dev.memberId)).toBeNull();
    await settings(200);

    await members.handleMemberUpdate(
      guildMember([dev.roleId, extraRoleId]),
      guildMember([dev.roleId]),
    );
    expect(await cache.getAdminAccess(dev.memberId)).toBeNull();
    await settings(403);
  });

  it('leaves no stale entry when a role is renamed or deleted in the main server', async () => {
    await grantSettingsRead(dev.roleId);
    await prime(200);

    await roleSync.handleRoleUpdate({
      id: dev.roleId,
      name: 'Renamed',
      color: 0,
      hoist: false,
      position: 2,
      managed: false,
      mentionable: false,
      permissions: { bitfield: 0n },
      guild: { id: root.serverId, roles: { cache: new Collection() } },
    } as any);
    expect(await cache.getAdminAccess(dev.memberId)).toBeNull();
    await settings(200);
    expect(await cache.getAdminAccess(dev.memberId)).not.toBeNull();

    await roleSync.handleRoleDelete({
      id: dev.roleId,
      name: 'Renamed',
      guild: { id: root.serverId },
    } as any);
    expect(await cache.getAdminAccess(dev.memberId)).toBeNull();
    await settings(403);
  });

  it('refuses a member on the next request after they leave the main server', async () => {
    await grantSettingsRead(dev.roleId);
    await prime(200);

    await members.handleMemberRemove(guildMember([dev.roleId]));

    expect(await cache.getAdminAccess(dev.memberId)).toBeNull();
    await settings(403);
    expect(
      await db
        .select()
        .from(serverMemberRoles)
        .where(eq(serverMemberRoles.memberId, dev.memberId)),
    ).toHaveLength(0);
  });
});
