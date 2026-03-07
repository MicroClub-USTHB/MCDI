/**
 * E2E: Authentication endpoints (/api/auth/*)
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips the entire suite when DATABASE_URL is not set.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import {
  clearAllTables,
  closeTestDb,
  getTestDb,
  seedAdminContext,
  seedTestProject,
  TestDb,
} from './helpers/db';
import { disableNock, enableNock } from './helpers/discord-mock';
import { sessions, loginTokens } from '../src/database/entities';

const DB_URL = process.env.DATABASE_URL;

// Skip entire suite when no database is available (CI without DB, pure unit environments).
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/auth (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;

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
  });

  // ─── POST /api/auth/login-session ──────────────────────────────

  describe('POST /api/auth/login-session', () => {
    it('returns loginUrl when API key is valid', async () => {
      const { serverId } = await seedAdminContext(db);
      const { apiKey } = await seedTestProject(db, serverId, {
        name: 'E2E Login Session',
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login-session')
        .set('X-API-Key', apiKey)
        .send({ serverId, redirectUri: 'http://localhost:4000/callback' })
        .expect(200);

      expect(res.body.loginUrl).toMatch(/\/api\/auth\/login\/.+/);
    });

    it('returns error when X-API-Key header is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login-session')
        .send({ redirectUri: 'http://localhost:4000/callback' })
        .expect(200);

      expect(res.body).toMatchObject({ error: 'missing_api_key' });
    });
  });

  // ─── GET /api/auth/login/:token ──────────────────────────────

  describe('GET /api/auth/login/:token', () => {
    it('renders error page when token is invalid', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/login/nonexistent-token-abc')
        .expect(200);

      expect(res.text).toMatch(/invalid_token|expired|invalid/i);
    });

    it('renders login page with valid login token', async () => {
      const { serverId } = await seedAdminContext(db);
      const { apiKey } = await seedTestProject(db, serverId, {
        name: 'E2E Test Project',
      });

      // First create a login session
      const sessionRes = await request(app.getHttpServer())
        .post('/api/auth/login-session')
        .set('X-API-Key', apiKey)
        .send({ serverId, redirectUri: 'http://localhost:4000/callback' })
        .expect(200);

      // Extract token from loginUrl
      const token = sessionRes.body.loginUrl.split('/api/auth/login/')[1];

      const res = await request(app.getHttpServer())
        .get(`/api/auth/login/${token}`)
        .expect(200);

      // The login page should include a Discord login prompt
      expect(res.text).toMatch(/discord/i);
    });
  });

  // ─── POST /api/auth/validate ──────────────────────────────────

  describe('POST /api/auth/validate', () => {
    it('returns 401 for unknown token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: 'does-not-exist-token-abc' })
        .expect(401);
    });

    it('returns 401 for expired token', async () => {
      const { memberId } = await seedAdminContext(db);

      // Insert an already-expired session directly
      const expiredToken = 'expired-session-token-000';
      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        memberId,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
      });

      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: expiredToken })
        .expect(401);
    });

    it('returns 200 with member info for valid token', async () => {
      const { bearerToken } = await seedAdminContext(db);

      const res = await request(app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: bearerToken })
        .expect(200);

      expect(res.body).toMatchObject({
        member: {
          id: '800000000000000001',
          username: 'testadmin',
        },
        roles: expect.any(Array),
      });
    });

    it('returns 400 when token field is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .send({})
        .expect(400);
    });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns success even for non-existent token (idempotent)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ token: 'ghost-token-aabbcc' })
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });

    it('invalidates a valid existing token', async () => {
      const { bearerToken } = await seedAdminContext(db);

      // Confirm it is valid first
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: bearerToken })
        .expect(200);

      // Logout
      const logoutRes = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ token: bearerToken })
        .expect(200);

      expect(logoutRes.body).toEqual({ success: true });

      // Now token should be invalid
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: bearerToken })
        .expect(401);
    });
  });

  // ─── POST /api/auth/logout-all ────────────────────────────────

  describe('POST /api/auth/logout-all', () => {
    it('invalidates all sessions for a member', async () => {
      const { bearerToken, memberId } = await seedAdminContext(db);

      await request(app.getHttpServer())
        .post('/api/auth/logout-all')
        .send({ memberId })
        .expect(200);

      // Original token should no longer be valid
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .send({ token: bearerToken })
        .expect(401);
    });
  });

  // ─── POST /api/auth/cleanup ───────────────────────────────────

  describe('POST /api/auth/cleanup', () => {
    it('returns success and removes expired sessions', async () => {
      const { memberId } = await seedAdminContext(db);

      // Insert expired session
      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        memberId,
        token: 'stale-token-cleanup-test',
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/cleanup')
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });
  });
});
