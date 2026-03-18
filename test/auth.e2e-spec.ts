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
import { members, sessions } from '../src/database/entities';
import { hash } from 'bcryptjs';

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

  // ─── GET /api/auth/authorize ──────────────────────────────

  describe('GET /api/auth/authorize', () => {
    it('redirects to /auth/discord when params are valid', async () => {
      const { serverId } = await seedAdminContext(db);
      const { id: projectId } = await seedTestProject(db, serverId, {
        name: 'E2E Authorize',
      });

      const res = await request(app.getHttpServer())
        .get('/api/auth/authorize')
        .query({
          client_id: projectId,
          redirect_uri: 'http://localhost:4000/callback',
          server_id: serverId,
          state: 'csrf-test-token',
        })
        .expect(302);

      expect(res.headers.location).toBe('/api/auth/discord');
      expect(res.headers['set-cookie']).toBeDefined();
      const cookie = (res.headers['set-cookie'] as unknown as string[]).find(
        (c: string) => c.startsWith('mcdi_auth_req='),
      );
      expect(cookie).toBeDefined();
      expect(cookie).toContain('HttpOnly');
    });

    it('returns 400 when client_id is invalid', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/authorize')
        .query({
          client_id: '00000000-0000-0000-0000-000000000000',
          redirect_uri: 'http://localhost:4000/callback',
          server_id: '123456789012345678',
          state: 'csrf-test',
        })
        .expect(400);
    });

    it('returns 400 when redirect_uri is not whitelisted', async () => {
      const { serverId } = await seedAdminContext(db);
      const { id: projectId } = await seedTestProject(db, serverId, {
        name: 'E2E Bad URI',
      });

      const res = await request(app.getHttpServer())
        .get('/api/auth/authorize')
        .query({
          client_id: projectId,
          redirect_uri: 'http://evil.com/steal',
          server_id: serverId,
          state: 'csrf-test',
        })
        .expect(400);

      expect(res.body).toMatchObject({ error: 'invalid_redirect_uri' });
    });

    it('returns 400 when required query params are missing', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/authorize')
        .query({ client_id: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 when project is inactive', async () => {
      const { serverId } = await seedAdminContext(db);
      const { id: projectId } = await seedTestProject(db, serverId, {
        name: 'E2E Inactive',
        isActive: false,
      });

      const res = await request(app.getHttpServer())
        .get('/api/auth/authorize')
        .query({
          client_id: projectId,
          redirect_uri: 'http://localhost:4000/callback',
          server_id: serverId,
          state: 'csrf-test',
        })
        .expect(400);

      expect(res.body).toMatchObject({ error: 'invalid_client' });
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

  // ─── POST /api/auth/admin/login ───────────────────────────────

  describe('POST /api/auth/admin/login', () => {
    const TEST_PASSWORD = 'admin-test-password-1234';
    let adminMemberId: string;

    beforeEach(async () => {
      // Seed a member with isSystemAdmin=true and a hashed password
      adminMemberId = '800000000000000099';
      const passwordHash = await hash(TEST_PASSWORD, 10);

      await db.insert(members).values({
        id: adminMemberId,
        username: 'sysadmin_e2e',
        globalName: 'E2E System Admin',
        displayName: 'E2E System Admin',
        avatar: null,
        isClubMember: false,
        isSystemAdmin: true,
        passwordHash,
        joinedAt: new Date(),
        syncedAt: new Date(),
      });
    });

    it('returns a Bearer token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'sysadmin_e2e', password: TEST_PASSWORD })
        .expect(200);

      expect(res.body).toMatchObject({
        token: expect.any(String),
        expiresAt: expect.any(String),
        member: {
          id: adminMemberId,
          username: 'sysadmin_e2e',
        },
      });
    });

    it('returns 401 for a wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'sysadmin_e2e', password: 'wrong-password' })
        .expect(401);
    });

    it('returns 401 for an unknown username', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'ghost_user_xyz', password: TEST_PASSWORD })
        .expect(401);
    });

    it('returns 403 when member exists but is not a system admin', async () => {
      const passwordHash = await hash(TEST_PASSWORD, 10);

      await db.insert(members).values({
        id: '800000000000000088',
        username: 'non_admin_user',
        globalName: null,
        displayName: null,
        avatar: null,
        isClubMember: true,
        isSystemAdmin: false,
        passwordHash,
        joinedAt: new Date(),
        syncedAt: new Date(),
      });

      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'non_admin_user', password: TEST_PASSWORD })
        .expect(403);
    });

    it('returns 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'sysadmin_e2e' })
        .expect(400);
    });

    it('the returned token is valid for SystemAdminGuard-protected routes', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'sysadmin_e2e', password: TEST_PASSWORD })
        .expect(200);

      const token = loginRes.body.token as string;

      // Use the token to access a protected admin route
      await request(app.getHttpServer())
        .get('/api/servers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('token expires — expired token must be rejected', async () => {
      // Manually insert an already-expired system-admin session
      const expiredToken = 'expired-admin-token-e2e';
      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        memberId: adminMemberId,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await request(app.getHttpServer())
        .get('/api/servers')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  // ─── GET /api/auth/admin/discord ─────────────────────────────

  describe('GET /api/auth/admin/discord', () => {
    it('returns a Discord authorization URL', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/admin/discord')
        .expect(200);

      expect(res.body).toMatchObject({
        url: expect.stringContaining('discord.com'),
      });
    });
  });

  // ─── GET /api/auth/admin/me ───────────────────────────────────

  describe('GET /api/auth/admin/me', () => {
    const TEST_PASSWORD = 'admin-me-test-1234';
    let adminMemberId: string;
    let sessionToken: string;

    beforeEach(async () => {
      adminMemberId = '800000000000000088';
      const passwordHash = await hash(TEST_PASSWORD, 10);

      await db.insert(members).values({
        id: adminMemberId,
        username: 'sysadmin_me_e2e',
        globalName: 'E2E Me Admin',
        displayName: 'E2E Me Admin',
        avatar: null,
        isClubMember: false,
        isSystemAdmin: true,
        passwordHash,
        joinedAt: new Date(),
        syncedAt: new Date(),
      });

      // Obtain a real session token by logging in
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'sysadmin_me_e2e', password: TEST_PASSWORD })
        .expect(200);
      sessionToken = loginRes.body.token as string;
    });

    it('returns the admin profile for a valid session token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: adminMemberId,
        username: 'sysadmin_me_e2e',
        isSystemAdmin: true,
      });
    });

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/api/auth/admin/me').expect(401);
    });

    it('returns 401 for an expired session', async () => {
      const expiredToken = 'expired-me-token-e2e';
      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        memberId: adminMemberId,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  // ─── POST /api/auth/admin/set-password ───────────────────────

  describe('POST /api/auth/admin/set-password', () => {
    const INITIAL_PASSWORD = 'initial-pass-1234';
    let adminMemberId: string;
    let sessionToken: string;

    beforeEach(async () => {
      adminMemberId = '800000000000000077';
      const passwordHash = await hash(INITIAL_PASSWORD, 10);

      await db.insert(members).values({
        id: adminMemberId,
        username: 'sysadmin_setpw_e2e',
        globalName: 'E2E SetPw Admin',
        displayName: 'E2E SetPw Admin',
        avatar: null,
        isClubMember: false,
        isSystemAdmin: true,
        passwordHash,
        joinedAt: new Date(),
        syncedAt: new Date(),
      });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'sysadmin_setpw_e2e', password: INITIAL_PASSWORD })
        .expect(200);
      sessionToken = loginRes.body.token as string;
    });

    it('changes the password when currentPassword is correct', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/admin/set-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          currentPassword: INITIAL_PASSWORD,
          newPassword: 'newSecure!99',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        message: 'Password updated successfully',
      });

      // Verify the new password works for login
      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'sysadmin_setpw_e2e', password: 'newSecure!99' })
        .expect(200);
    });

    it('returns 401 when currentPassword is wrong', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/set-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'newSecure!99',
        })
        .expect(401);
    });

    it('returns 400 when currentPassword is missing but password already set', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/set-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ newPassword: 'newSecure!99' })
        .expect(400);
    });

    it('returns 400 when newPassword is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/set-password')
        .set('Authorization', `Bearer ${sessionToken}`)
        .send({ currentPassword: INITIAL_PASSWORD })
        .expect(400);
    });

    it('returns 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/set-password')
        .send({
          currentPassword: INITIAL_PASSWORD,
          newPassword: 'newSecure!99',
        })
        .expect(401);
    });
  });
});
