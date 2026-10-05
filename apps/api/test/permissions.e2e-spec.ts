/**
 * E2E: Permissions endpoints (/api/permissions/*)
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips entire suite when DATABASE_URL is not set.
 *
 * Auth model:
 *   - check / check-batch / getMemberPermissions: API key guard
 *   - inheritance-rules: SystemAdminGuard (Bearer token)
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import {
  AdminContext,
  clearAllTables,
  closeTestDb,
  getTestDb,
  MemberFixture,
  seedAdminContext,
  seedMemberWithRole,
  seedTestProject,
  TestDb,
} from './helpers/db';
import { disableNock, enableNock } from './helpers/discord-mock';
import * as schema from '../src/database/entities';
import {
  servers,
  permissions as permissionsTable,
  rolePermissions,
} from '../src/database/entities';
import { eq, count } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/permissions (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let adminCtx: AdminContext;
  let apiKey: string;
  let member: MemberFixture;

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
    adminCtx = await seedAdminContext(db);

    // Project linked to main server — permissions/check doesn't require a scope
    const project = await seedTestProject(db, adminCtx.serverId, {
      name: 'Permissions E2E Project',
      scopes: ['check_permissions'],
    });
    apiKey = project.apiKey;

    member = await seedMemberWithRole(db, adminCtx.serverId, {
      username: 'perm_member',
    });
  });

  const auth = () => `Bearer ${adminCtx.bearerToken}`;

  // ─── POST /api/permissions/check ──────────────────────────────

  describe('POST /api/permissions/check', () => {
    it('returns 401 with no API key', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/check')
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permission: 'READ_MEMBERS',
        })
        .expect(401);
    });

    it('returns allowed:false for a member without the permission', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/permissions/check')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permission: 'NONEXISTENT_PERMISSION',
        })
        .expect(200);

      expect(res.body).toMatchObject({ allowed: false });
    });

    it('returns 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/check')
        .set('X-API-Key', apiKey)
        .send({ discordId: member.id })
        .expect(400);
    });

    it('returns 400 when permission field is empty string', async () => {
      // The service validates via BadRequestException for empty string fields
      const res = await request(app.getHttpServer())
        .post('/api/permissions/check')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permission: '',
        })
        .expect(400);

      expect(res.body).toMatchObject({
        message: expect.stringContaining('required'),
      });
    });

    it('returns allowed:true for a member whose role grants the permission', async () => {
      const [perm] = await db
        .insert(permissionsTable)
        .values({ key: 'READ_MEMBERS' })
        .returning();

      await db.insert(rolePermissions).values({
        roleId: member.roleId,
        permissionId: perm.id,
      });

      const res = await request(app.getHttpServer())
        .post('/api/permissions/check')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permission: 'READ_MEMBERS',
        })
        .expect(200);

      expect(res.body).toMatchObject({ allowed: true });
    });
  });

  // ─── POST /api/permissions/check-batch ────────────────────────

  describe('POST /api/permissions/check-batch', () => {
    it('returns 401 with no API key', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/check-batch')
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permissions: ['READ_MEMBERS'],
          mode: 'ALL',
        })
        .expect(401);
    });

    it('checks batch with mode=ALL — returns false when member lacks all', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/permissions/check-batch')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permissions: ['MANAGE_CHANNELS', 'BAN_MEMBERS'],
          mode: 'ALL',
        })
        .expect(200);

      expect(res.body).toMatchObject({ allowed: false });
    });

    it('checks batch with mode=ANY — returns false when member lacks all', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/permissions/check-batch')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permissions: ['MANAGE_CHANNELS', 'BAN_MEMBERS'],
          mode: 'ANY',
        })
        .expect(200);

      expect(res.body).toMatchObject({ allowed: false });
    });

    it('returns 400 when mode is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/check-batch')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permissions: ['READ_MEMBERS'],
          mode: 'INVALID_MODE',
        })
        .expect(400);
    });

    it('returns 400 when permissions array is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/check-batch')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          mode: 'ANY',
        })
        .expect(400);
    });

    it('returns allowed:true (mode=ALL) when the member holds the requested permission', async () => {
      const [perm] = await db
        .insert(permissionsTable)
        .values({ key: 'READ_MEMBERS' })
        .returning();

      await db.insert(rolePermissions).values({
        roleId: member.roleId,
        permissionId: perm.id,
      });

      const res = await request(app.getHttpServer())
        .post('/api/permissions/check-batch')
        .set('X-API-Key', apiKey)
        .send({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permissions: ['READ_MEMBERS'],
          mode: 'ALL',
        })
        .expect(200);

      expect(res.body).toMatchObject({ allowed: true });
    });
  });

  // ─── GET /api/permissions/:serverId/:discordId ─────────────────

  describe('GET /api/permissions/:serverId/:discordId', () => {
    it('returns 401 with no API key', async () => {
      await request(app.getHttpServer())
        .get(`/api/permissions/${adminCtx.serverId}/${member.id}`)
        .expect(401);
    });

    it('returns full permission set for an existing member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/permissions/${adminCtx.serverId}/${member.id}`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(res.body).toMatchObject({
        discordId: member.id,
        serverId: adminCtx.serverId,
        permissions: expect.any(Array),
      });
    });

    it('returns empty permissions for an unknown member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/permissions/${adminCtx.serverId}/000000000000000099`)
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(res.body.permissions).toEqual([]);
    });

    it('returns 403 when server is inactive', async () => {
      await db
        .update(servers)
        .set({ isActive: false })
        .where(eq(servers.id, adminCtx.serverId));

      await request(app.getHttpServer())
        .get(`/api/permissions/${adminCtx.serverId}/${member.id}`)
        .set('X-API-Key', apiKey)
        .expect(403);
    });
  });

  // ─── Project access and scope enforcement ─────────────────────

  describe('project access and scope', () => {
    const OTHER_SERVER_ID = '900000000000000002';
    let noAccessKey: string;
    let noScopeKey: string;

    beforeEach(async () => {
      await db.insert(servers).values({
        id: OTHER_SERVER_ID,
        name: 'Other Server',
        icon: null,
        isMain: false,
        isActive: true,
        type: 'club',
        syncedAt: new Date(),
      });
      // Access to the other server only, none to the main server
      noAccessKey = (
        await seedTestProject(db, OTHER_SERVER_ID, {
          name: 'No Access Project',
          scopes: ['check_permissions'],
        })
      ).apiKey;
      // Access to the main server, but without the check_permissions scope
      noScopeKey = (
        await seedTestProject(db, adminCtx.serverId, {
          name: 'No Scope Project',
          scopes: ['read_members'],
        })
      ).apiKey;
    });

    const body = () => ({
      discordId: member.id,
      serverId: adminCtx.serverId,
      permission: 'READ_MEMBERS',
    });

    it.each([
      ['check', () => body()],
      [
        'check-batch',
        () => ({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permissions: ['READ_MEMBERS'],
          mode: 'ALL',
        }),
      ],
    ])(
      'POST %s returns 403 for a project without access to the server',
      async (route, payload) => {
        await request(app.getHttpServer())
          .post(`/api/permissions/${route}`)
          .set('X-API-Key', noAccessKey)
          .send(payload())
          .expect(403);
      },
    );

    it.each([
      ['check', () => body()],
      [
        'check-batch',
        () => ({
          discordId: member.id,
          serverId: adminCtx.serverId,
          permissions: ['READ_MEMBERS'],
          mode: 'ALL',
        }),
      ],
    ])(
      'POST %s returns 403 for a project without the check_permissions scope',
      async (route, payload) => {
        await request(app.getHttpServer())
          .post(`/api/permissions/${route}`)
          .set('X-API-Key', noScopeKey)
          .send(payload())
          .expect(403);
      },
    );

    it('GET /:serverId/:discordId returns 403 for a project without the check_permissions scope', async () => {
      await request(app.getHttpServer())
        .get(`/api/permissions/${adminCtx.serverId}/${member.id}`)
        .set('X-API-Key', noScopeKey)
        .expect(403);
    });
  });

  // ─── POST /api/permissions/inheritance-rules (admin) ──────────

  describe('POST /api/permissions/inheritance-rules', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/inheritance-rules')
        .send({ sourceRoleId: adminCtx.roleId, targetScope: 'all' })
        .expect(401);
    });

    it('creates an inheritance rule for targetScope=all', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/permissions/inheritance-rules')
        .set('Authorization', auth())
        .send({
          sourceRoleId: adminCtx.roleId,
          targetScope: 'all',
          enabled: true,
        })
        .expect(200);

      expect(res.body.rule).toMatchObject({
        sourceRoleId: adminCtx.roleId,
        targetScope: 'all',
        enabled: true,
      });
    });

    it('creates an inheritance rule for targetScope=selected with server IDs', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/permissions/inheritance-rules')
        .set('Authorization', auth())
        .send({
          sourceRoleId: adminCtx.roleId,
          targetScope: 'selected',
          targetServerIds: [adminCtx.serverId],
          enabled: true,
        })
        .expect(200);

      expect(res.body.rule).toMatchObject({ sourceRoleId: adminCtx.roleId });
    });

    it('returns 400 when targetScope=selected but targetServerIds is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/inheritance-rules')
        .set('Authorization', auth())
        .send({ sourceRoleId: adminCtx.roleId, targetScope: 'selected' })
        .expect(400);
    });

    it('returns 400 when targetScope is invalid', async () => {
      await request(app.getHttpServer())
        .post('/api/permissions/inheritance-rules')
        .set('Authorization', auth())
        .send({ sourceRoleId: adminCtx.roleId, targetScope: 'invalid' })
        .expect(400);
    });
  });

  // ─── GET /api/permissions/inheritance-rules (admin) ───────────

  describe('GET /api/permissions/inheritance-rules', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get('/api/permissions/inheritance-rules')
        .expect(401);
    });

    it('returns array of inheritance rules', async () => {
      // Seed a rule first
      await request(app.getHttpServer())
        .post('/api/permissions/inheritance-rules')
        .set('Authorization', auth())
        .send({
          sourceRoleId: adminCtx.roleId,
          targetScope: 'all',
          enabled: true,
        });

      const res = await request(app.getHttpServer())
        .get('/api/permissions/inheritance-rules')
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── GET /api/permissions/admin/servers/:serverId/roles/:roleId/permissions ─

  describe('GET /api/permissions/admin/servers/:serverId/roles/:roleId/permissions', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/permissions`,
        )
        .expect(401);
    });

    it('returns role permissions list on success', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/permissions`,
        )
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        roleId: adminCtx.roleId,
        serverId: adminCtx.serverId,
        permissions: expect.any(Array),
      });
    });

    it('returns 400 when role does not exist', async () => {
      await request(app.getHttpServer())
        .get(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/000000000000000000/permissions`,
        )
        .set('Authorization', auth())
        .expect(400);
    });
  });

  // ─── POST /api/permissions/admin/servers/:serverId/roles/:roleId/permissions ─

  describe('POST /api/permissions/admin/servers/:serverId/roles/:roleId/permissions', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/permissions`,
        )
        .send({ permissionIds: [1] })
        .expect(401);
    });

    it('assigns permissions and returns updated list', async () => {
      const perm = await db
        .insert(permissionsTable)
        .values({ key: 'TEST_PERM_ASSIGN', description: 'Test assign' })
        .returning({ id: permissionsTable.id });

      const res = await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/permissions`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [perm[0].id] })
        .expect(200);

      expect(res.body).toMatchObject({
        roleId: adminCtx.roleId,
        serverId: adminCtx.serverId,
      });
      expect(res.body.permissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: perm[0].id, key: 'TEST_PERM_ASSIGN' }),
        ]),
      );
    });

    it('returns 400 when permissionIds contains non-existent IDs', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/permissions`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [999999] })
        .expect(400);
    });

    it('returns 400 when permissionIds is empty', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/permissions`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [] })
        .expect(400);
    });
  });

  // ─── DELETE /api/permissions/admin/servers/:serverId/roles/:roleId/permissions/:permissionId ─

  describe('DELETE /api/permissions/admin/servers/:serverId/roles/:roleId/permissions/:permissionId', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .delete(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/permissions/1`,
        )
        .expect(401);
    });

    it('returns 403 when role is global', async () => {
      const globalRoleId = '700000000000000099';
      await db.insert(schema.roles).values({
        id: globalRoleId,
        serverId: adminCtx.serverId,
        name: 'GlobalRole',
        color: 0xff0000,
        hoist: true,
        position: 10,
        managed: false,
        mentionable: false,
        isGlobal: true,
        hierarchyLevel: 1,
      });

      const perm = await db
        .insert(permissionsTable)
        .values({ key: 'TEST_PERM_GLOBAL', description: 'Test global' })
        .returning({ id: permissionsTable.id });

      await db.insert(rolePermissions).values({
        roleId: globalRoleId,
        permissionId: perm[0].id,
      });

      await request(app.getHttpServer())
        .delete(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${globalRoleId}/permissions/${perm[0].id}`,
        )
        .set('Authorization', auth())
        .expect(403);
    });

    it('returns 403 when role has highest rank (min hierarchyLevel)', async () => {
      const execRoleId = '700000000000000088';
      await db.insert(schema.roles).values({
        id: execRoleId,
        serverId: adminCtx.serverId,
        name: 'TopExecutive',
        color: 0xffd700,
        hoist: true,
        position: 10,
        managed: false,
        mentionable: false,
        isGlobal: false,
        hierarchyLevel: 1,
      });

      const perm = await db
        .insert(permissionsTable)
        .values({ key: 'TEST_PERM_EXEC', description: 'Test exec' })
        .returning({ id: permissionsTable.id });

      await db.insert(rolePermissions).values({
        roleId: execRoleId,
        permissionId: perm[0].id,
      });

      await request(app.getHttpServer())
        .delete(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${execRoleId}/permissions/${perm[0].id}`,
        )
        .set('Authorization', auth())
        .expect(403);
    });

    it('returns 204 on successful removal', async () => {
      const higherRoleId = '700000000000000076';
      await db.insert(schema.roles).values({
        id: higherRoleId,
        serverId: adminCtx.serverId,
        name: 'HigherRole',
        color: 0xff0000,
        hoist: true,
        position: 5,
        managed: false,
        mentionable: false,
        isGlobal: false,
        hierarchyLevel: 1,
      });

      const memberRoleId = '700000000000000077';
      await db.insert(schema.roles).values({
        id: memberRoleId,
        serverId: adminCtx.serverId,
        name: 'LowMember',
        color: 0x00ff00,
        hoist: false,
        position: 10,
        managed: false,
        mentionable: false,
        isGlobal: false,
        hierarchyLevel: 10,
      });

      const perm = await db
        .insert(permissionsTable)
        .values({ key: 'TEST_PERM_REMOVE', description: 'Test remove' })
        .returning({ id: permissionsTable.id });

      await db.insert(rolePermissions).values({
        roleId: memberRoleId,
        permissionId: perm[0].id,
      });

      await request(app.getHttpServer())
        .delete(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${memberRoleId}/permissions/${perm[0].id}`,
        )
        .set('Authorization', auth())
        .expect(204);
    });
  });

  // ─── POST /api/permissions/admin/servers/:serverId/roles/:roleId/impact ─

  describe('POST /api/permissions/admin/servers/:serverId/roles/:roleId/impact', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/impact`,
        )
        .send({ permissionIds: [1], action: 'add' })
        .expect(401);
    });

    it('returns accurate member count and IDs', async () => {
      const res = await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/impact`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [1], action: 'add' })
        .expect(200);

      expect(res.body).toMatchObject({
        affectedMembers: 1,
        roleHolders: 1,
        memberIds: expect.arrayContaining([adminCtx.memberId]),
      });
    });

    it('returns zero counts when no members hold the role', async () => {
      const emptyRoleId = '700000000000000066';
      await db.insert(schema.roles).values({
        id: emptyRoleId,
        serverId: adminCtx.serverId,
        name: 'EmptyRole',
        color: 0x888888,
        hoist: false,
        position: 5,
        managed: false,
        mentionable: false,
        isGlobal: false,
        hierarchyLevel: 5,
      });

      const res = await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${emptyRoleId}/impact`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [1], action: 'add' })
        .expect(200);

      expect(res.body).toMatchObject({
        affectedMembers: 0,
        roleHolders: 0,
        memberIds: [],
      });
    });

    it('is read-only: does not modify role_permissions table', async () => {
      const [{ count: beforeCount }] = await db
        .select({ count: count() })
        .from(rolePermissions);

      await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/impact`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [1], action: 'add' });

      const [{ count: afterCount }] = await db
        .select({ count: count() })
        .from(rolePermissions);

      expect(afterCount).toBe(beforeCount);
    });

    it('returns 0 affected when member already has the permission via another role (add)', async () => {
      // Create a permission
      const perm = await db
        .insert(permissionsTable)
        .values({ key: 'TEST_IMPACT_ADD_ALREADY_HAVE', description: null })
        .returning({ id: permissionsTable.id });

      // Create a second role, assign the perm to it, assign role to admin
      const otherRoleId = '700000000000000077';
      await db.insert(schema.roles).values({
        id: otherRoleId,
        serverId: adminCtx.serverId,
        name: 'OtherRole',
        color: 0x00ff00,
        hoist: false,
        position: 10,
        managed: false,
        mentionable: false,
        isGlobal: false,
        hierarchyLevel: 10,
      });
      await db.insert(rolePermissions).values({
        roleId: otherRoleId,
        permissionId: perm[0].id,
      });
      await db.insert(schema.serverMemberRoles).values({
        memberId: adminCtx.memberId,
        roleId: otherRoleId,
      });

      // Preview adding the same permission to adminCtx.roleId
      const res = await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/impact`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [perm[0].id], action: 'add' })
        .expect(200);

      // Admin already has the perm via otherRole, so no impact
      expect(res.body).toMatchObject({
        affectedMembers: 0,
        roleHolders: 1,
        memberIds: [],
      });
    });

    it('returns affected members who would lose permission on remove', async () => {
      // Create a permission and assign it directly to adminCtx.roleId
      const perm = await db
        .insert(permissionsTable)
        .values({ key: 'TEST_IMPACT_REMOVE_LOSE', description: null })
        .returning({ id: permissionsTable.id });

      await db.insert(rolePermissions).values({
        roleId: adminCtx.roleId,
        permissionId: perm[0].id,
      });

      const res = await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/impact`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [perm[0].id], action: 'remove' })
        .expect(200);

      // Admin has the perm only through this role — would lose it
      expect(res.body).toMatchObject({
        affectedMembers: 1,
        roleHolders: 1,
        memberIds: [adminCtx.memberId],
      });
    });

    it('returns 0 affected when member has permission via another role too (remove)', async () => {
      // Create a permission
      const perm = await db
        .insert(permissionsTable)
        .values({ key: 'TEST_IMPACT_REMOVE_STILL_HAVE', description: null })
        .returning({ id: permissionsTable.id });

      // Assign to adminCtx.roleId
      await db.insert(rolePermissions).values({
        roleId: adminCtx.roleId,
        permissionId: perm[0].id,
      });

      // Create a second role with the same perm and assign to admin
      const otherRoleId = '700000000000000078';
      await db.insert(schema.roles).values({
        id: otherRoleId,
        serverId: adminCtx.serverId,
        name: 'FallbackRole',
        color: 0x0000ff,
        hoist: false,
        position: 10,
        managed: false,
        mentionable: false,
        isGlobal: false,
        hierarchyLevel: 10,
      });
      await db.insert(rolePermissions).values({
        roleId: otherRoleId,
        permissionId: perm[0].id,
      });
      await db.insert(schema.serverMemberRoles).values({
        memberId: adminCtx.memberId,
        roleId: otherRoleId,
      });

      const res = await request(app.getHttpServer())
        .post(
          `/api/permissions/admin/servers/${adminCtx.serverId}/roles/${adminCtx.roleId}/impact`,
        )
        .set('Authorization', auth())
        .send({ permissionIds: [perm[0].id], action: 'remove' })
        .expect(200);

      // Admin has the perm via otherRole too — no impact
      expect(res.body).toMatchObject({
        affectedMembers: 0,
        roleHolders: 1,
        memberIds: [],
      });
    });
  });
});
