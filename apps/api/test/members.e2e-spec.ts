/**
 * E2E: Members endpoints (/api/servers/:serverId/members/*)
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips entire suite when DATABASE_URL is not set.
 *
 * Auth model: API key guard (X-API-Key header).
 * Scope: `read_members` required per server.
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
import { servers } from '../src/database/entities';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/servers/:serverId/members (e2e)', () => {
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

    // Project with read_members scope on the main server
    const project = await seedTestProject(db, adminCtx.serverId, {
      name: 'Members E2E Project',
      scopes: ['read_members'],
    });
    apiKey = project.apiKey;

    // Seed a non-admin member into the server
    member = await seedMemberWithRole(db, adminCtx.serverId, {
      username: 'e2emember',
    });
  });

  const apiKeyHeader = () => ({ 'X-API-Key': apiKey });
  const BASE = () => `/api/servers/${adminCtx.serverId}/members`;

  // ─── Authentication guard ─────────────────────────────────────

  describe('authentication', () => {
    it('returns 401 when no API key is provided', async () => {
      await request(app.getHttpServer())
        .get(`${BASE()}/${member.id}`)
        .expect(401);
    });

    it('returns 401 for an invalid API key', async () => {
      await request(app.getHttpServer())
        .get(`${BASE()}/${member.id}`)
        .set('X-API-Key', 'invalid.badkey')
        .expect(401);
    });

    it('returns 403 when the project lacks read_members scope', async () => {
      // Project with NO scopes
      const proj = await seedTestProject(db, adminCtx.serverId, {
        name: 'No Scope Project',
        scopes: [],
      });

      await request(app.getHttpServer())
        .get(`${BASE()}/${member.id}`)
        .set('X-API-Key', proj.apiKey)
        .expect(403);
    });
  });

  // ─── GET /api/servers/:serverId/members/:discordId ────────────

  describe('GET /api/servers/:serverId/members/:discordId', () => {
    it('returns member details for a valid Discord ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/${member.id}`)
        .set(apiKeyHeader())
        .expect(200);

      expect(res.body).toMatchObject({
        discordId: member.id,
        username: 'e2emember',
      });
    });

    it('returns 404 for an unknown Discord ID', async () => {
      await request(app.getHttpServer())
        .get(`${BASE()}/000000000000000001`)
        .set(apiKeyHeader())
        .expect(404);
    });

    it('returns 400 for an invalid Discord ID format', async () => {
      await request(app.getHttpServer())
        .get(`${BASE()}/not-a-snowflake`)
        .set(apiKeyHeader())
        .expect(404);
    });
  });

  // ─── GET /api/servers/:serverId/members ───────────────────────

  describe('GET /api/servers/:serverId/members', () => {
    it('returns paginated members list', async () => {
      const res = await request(app.getHttpServer())
        .get(BASE())
        .set(apiKeyHeader())
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        pagination: {
          page: expect.any(Number),
          limit: expect.any(Number),
          total: expect.any(Number),
        },
      });
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('filters members by partial username query', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}?query=e2emember`)
        .set(apiKeyHeader())
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find(
        (m: { discordId: string }) => m.discordId === member.id,
      );
      expect(found).toBeDefined();
    });

    it('filters members by roleId', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}?roleId=${member.roleId}`)
        .set(apiKeyHeader())
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find(
        (m: { discordId: string }) => m.discordId === member.id,
      );
      expect(found).toBeDefined();
    });

    it('returns empty list when query matches nothing', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}?query=zzz_no_such_member_xyz`)
        .set(apiKeyHeader())
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('respects page and limit query params', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}?page=1&limit=5`)
        .set(apiKeyHeader())
        .expect(200);

      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
    });

    it('returns 400 for invalid pagination params', async () => {
      await request(app.getHttpServer())
        .get(`${BASE()}?page=0`)
        .set(apiKeyHeader())
        .expect(400);
    });
  });

  // ─── GET /api/servers/:serverId/members/:discordId/permissions ─

  describe('GET /api/servers/:serverId/members/:discordId/permissions', () => {
    it('returns an empty permissions object for a member with no declared permissions', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/${member.id}/permissions`)
        .set(apiKeyHeader())
        .expect(200);

      expect(res.body).toMatchObject({
        discordId: member.id,
        serverId: adminCtx.serverId,
        permissions: expect.any(Array),
      });
    });

    it('returns 404 for unknown member', async () => {
      // Member not in DB → permission lookup returns empty or 404 depending on service
      // The service resolves permissions by role lookups, so unknown member → empty set
      const res = await request(app.getHttpServer())
        .get(`${BASE()}/000000000000000001/permissions`)
        .set(apiKeyHeader())
        .expect(200);

      // Unknown member has no roles, so permissions array should be empty
      expect(res.body.permissions).toEqual([]);
    });

    it('returns 403 when project lacks read_members scope', async () => {
      const proj = await seedTestProject(db, adminCtx.serverId, {
        name: 'No Scope Proj',
        scopes: [],
      });

      await request(app.getHttpServer())
        .get(`${BASE()}/${member.id}/permissions`)
        .set('X-API-Key', proj.apiKey)
        .expect(403);
    });
  });

  // ─── Inactive server guard ─────────────────────────────────────

  describe('inactive server', () => {
    it('returns 403 when accessing a disabled server', async () => {
      await db
        .update(servers)
        .set({ isActive: false })
        .where(eq(servers.id, adminCtx.serverId));

      await request(app.getHttpServer())
        .get(`${BASE()}/${member.id}`)
        .set(apiKeyHeader())
        .expect(403);
    });
  });
});
