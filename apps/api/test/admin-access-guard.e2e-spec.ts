/**
 * E2E: AdminAccessGuard enforcement on the admin API.
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`) and Redis.
 * Root is the Executive role seeded by `seedAdminContext`
 * (MC_EXECUTIVE_ROLE_ID is set in `createTestApp`). Granting levels is covered
 * by `admin-access.e2e-spec.ts`; here a member simply holds no grant.
 */
import { INestApplication } from '@nestjs/common';
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
import { PermissionCacheService } from '../src/modules/permissions/permission-cache.service';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('AdminAccessGuard (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let root: AdminContext;
  let member: MemberContext;

  beforeAll(async () => {
    enableNock();
    db = getTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    disableNock();
    await closeTestDb();
    await app.close();
  });

  beforeEach(async () => {
    await clearAllTables(db);
    // Admin access is cached in Redis, which clearAllTables does not touch.
    await app.get(PermissionCacheService).clear();
    root = await seedAdminContext(db);
    member = await seedNonRootMember(db, root.serverId);
  });

  const as = (token: string) => `Bearer ${token}`;
  const http = () => request(app.getHttpServer());

  it('refuses a request with no session', async () => {
    await http().get('/api/admin/settings').expect(401);
  });

  it('lets a member with no grant read their own identity, with every level none', async () => {
    const res = await http()
      .get('/api/auth/admin/me')
      .set('Authorization', as(member.bearerToken))
      .expect(200);

    expect(res.body.root).toBe(false);
    expect(Object.values(res.body.permissions)).toEqual(
      Object.values(res.body.permissions).map(() => 'none'),
    );
    expect(res.body.permissions.members).toBe('none');
  });

  it('refuses a member with no grant on admin endpoints, naming the resource and level', async () => {
    const res = await http()
      .get('/api/admin/settings')
      .set('Authorization', as(member.bearerToken))
      .expect(403);
    expect(res.body.message).toBe("Requires 'read' access on 'settings'");

    await http()
      .post('/api/admin/settings/reset')
      .set('Authorization', as(member.bearerToken))
      .expect(403);
    await http()
      .get('/api/admin/members')
      .set('Authorization', as(member.bearerToken))
      .expect(403);
  });

  it('reports root with manage on every resource for a root admin', async () => {
    const res = await http()
      .get('/api/auth/admin/me')
      .set('Authorization', as(root.bearerToken))
      .expect(200);

    expect(res.body.root).toBe(true);
    expect(res.body.permissions.settings).toBe('manage');
    expect(res.body.permissions.messages).toBe('manage');
  });

  it('keeps a root admin working on the admin endpoints', async () => {
    await http()
      .get('/api/admin/settings')
      .set('Authorization', as(root.bearerToken))
      .expect(200);
  });
});
