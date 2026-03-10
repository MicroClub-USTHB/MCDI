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
        .send({ discordId: member.id, serverId: adminCtx.serverId, permission: 'READ_MEMBERS' })
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
        .send({ discordId: member.id, serverId: adminCtx.serverId, permission: '' })
        .expect(400);

      expect(res.body).toMatchObject({
        message: expect.stringContaining('required'),
      });
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
        .send({ discordId: member.id, serverId: adminCtx.serverId, mode: 'ANY' })
        .expect(400);
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
      const { servers } = await import('../src/database/entities');
      const { eq } = await import('drizzle-orm');
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
        .send({ sourceRoleId: adminCtx.roleId, targetScope: 'all', enabled: true })
        .expect(200);

      expect(res.body).toMatchObject({
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

      expect(res.body).toMatchObject({ sourceRoleId: adminCtx.roleId });
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
        .send({ sourceRoleId: adminCtx.roleId, targetScope: 'all', enabled: true });

      const res = await request(app.getHttpServer())
        .get('/api/permissions/inheritance-rules')
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
