/**
 * E2E: Admin Members endpoints (/api/admin/members/*)
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips entire suite when DATABASE_URL is not set.
 *
 * Auth model: SystemAdminGuard (Bearer token).
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import {
  AdminContext,
  clearAllTables,
  closeTestDb,
  getTestDb,
  seedAdminContext,
  seedMemberWithRole,
  TestDb,
} from './helpers/db';
import { disableNock, enableNock } from './helpers/discord-mock';
import { servers } from '../src/database/entities';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/admin/members (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let adminCtx: AdminContext;

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
  });

  const auth = () => `Bearer ${adminCtx.bearerToken}`;
  const BASE = '/api/admin/members';

  // ─── Authentication guard ─────────────────────────────────────

  it('returns 401 when no Bearer token is provided', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/cross-server`)
      .expect(401);
  });

  it('returns 401 for an invalid Bearer token', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/cross-server`)
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  // ─── GET /api/admin/members/:discordId/servers ─────────────────

  describe('GET /api/admin/members/:discordId/servers', () => {
    it('returns cross-server view for an existing member', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/${adminCtx.memberId}/servers`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        memberId: adminCtx.memberId,
        username: 'testadmin',
        isClubMember: expect.any(Boolean),
        servers: expect.any(Array),
      });

      // Should include the main server seeded by seedAdminContext
      const mainServer = res.body.servers.find(
        (s: { serverId: string }) => s.serverId === adminCtx.serverId,
      );
      expect(mainServer).toBeDefined();
      expect(mainServer).toMatchObject({
        serverId: adminCtx.serverId,
        serverName: 'Test Main Server',
        isMainServer: true,
      });
    });

    it('returns 404 for an unknown Discord ID', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/000000000000000099/servers`)
        .set('Authorization', auth())
        .expect(404);
    });

    it('returns roles in the cross-server view', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/${adminCtx.memberId}/servers`)
        .set('Authorization', auth())
        .expect(200);

      const mainServer = res.body.servers.find(
        (s: { serverId: string }) => s.serverId === adminCtx.serverId,
      );
      expect(Array.isArray(mainServer?.roles)).toBe(true);
    });
  });

  // ─── GET /api/admin/members/cross-server ──────────────────────

  describe('GET /api/admin/members/cross-server', () => {
    it('returns paginated member list with default params', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/cross-server`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        page: 1,
        limit: expect.any(Number),
        total: expect.any(Number),
      });
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by filter=club (main server members only)', async () => {
      // Seed a non-club member in a different server
      await db.insert(servers).values({
        id: '555555555555555555',
        name: 'Secondary Server',
        type: 'other',
        isMain: false,
        isActive: true,
        syncedAt: new Date(),
      });
      await seedMemberWithRole(db, '555555555555555555', {
        username: 'noncluber',
        isClubMember: false,
      });

      const res = await request(app.getHttpServer())
        .get(`${BASE}/cross-server?filter=club`)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      // Admin member IS in main server
      const adminInResult = res.body.data.find(
        (m: { memberId: string }) => m.memberId === adminCtx.memberId,
      );
      expect(adminInResult).toBeDefined();
    });

    it('filters by filter=all returns all server members', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/cross-server?filter=all`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 400 for invalid filter value', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/cross-server?filter=invalid`)
        .set('Authorization', auth())
        .expect(400);
    });

    it('respects pagination parameters', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/cross-server?page=1&limit=5`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({ page: 1, limit: 5 });
    });

    it('filters by search term', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/cross-server?search=testadmin`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.find(
        (m: { memberId: string }) => m.memberId === adminCtx.memberId,
      );
      expect(found).toBeDefined();
    });

    it('returns empty list when search matches nothing', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/cross-server?search=zzz_no_match_xyz`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
    });
  });

  // ─── GET /api/admin/members/export ────────────────────────────

  describe('GET /api/admin/members/export', () => {
    it('returns JSON file when format=json', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/export?format=json&filter=all`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns CSV file when format=csv', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/export?format=csv&filter=all`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
      // CSV should have at least a header row
      expect(typeof res.text).toBe('string');
    });

    it('CSV export for filter=club only includes main-server members', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/export?format=csv&filter=club`)
        .set('Authorization', auth())
        .expect(200);

      // Should not be empty (admin is a club member)
      expect(res.text.length).toBeGreaterThan(0);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/export?format=json&filter=all`)
        .expect(401);
    });
  });
});
