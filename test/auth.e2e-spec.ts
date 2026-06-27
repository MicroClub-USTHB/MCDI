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
import {
  disableNock,
  enableNock,
  mockDiscordToken,
  mockDiscordProfile,
  mockDiscordGuildMember,
  mockDiscordGuildRoles,
} from './helpers/discord-mock';
import {
  sessions,
  callbackCodes,
  roles,
  ssoSessions,
} from '../src/database/entities';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import nock from 'nock';
import { hashSessionToken } from '../src/common/utils/session-token.util';
import { hashSsoToken } from '../src/common/utils/sso-token.util';

const DB_URL = process.env.DATABASE_URL;

// Skip entire suite when no database is available (CI without DB, pure unit environments).
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/auth (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;

  const seedProjectSessionContext = async (name = 'E2E Auth Project') => {
    const adminCtx = await seedAdminContext(db);
    const project = await seedTestProject(db, adminCtx.serverId, { name });

    await db
      .update(sessions)
      .set({
        projectId: project.id,
        serverId: adminCtx.serverId,
      })
      .where(eq(sessions.token, hashSessionToken(adminCtx.bearerToken)));

    return { ...adminCtx, project };
  };

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
      const { project } = await seedProjectSessionContext(
        'E2E Validate Unknown',
      );

      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .set('x-api-key', project.apiKey)
        .send({ token: 'does-not-exist-token-abc' })
        .expect(401);
    });

    it('returns 401 for expired token', async () => {
      const { memberId, serverId, project } = await seedProjectSessionContext(
        'E2E Validate Expired',
      );

      // Insert an already-expired session directly
      const expiredToken = 'expired-session-token-000';
      await db.insert(sessions).values({
        id: crypto.randomUUID(),
        memberId,
        projectId: project.id,
        serverId,
        token: hashSessionToken(expiredToken),
        expiresAt: new Date(Date.now() - 60_000), // 1 minute ago
      });

      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .set('x-api-key', project.apiKey)
        .send({ token: expiredToken })
        .expect(401);
    });

    it('returns 200 with member info for valid token', async () => {
      const { bearerToken, project } =
        await seedProjectSessionContext('E2E Validate Valid');

      const res = await request(app.getHttpServer())
        .post('/api/auth/validate')
        .set('x-api-key', project.apiKey)
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
      const { project } = await seedProjectSessionContext(
        'E2E Validate Missing',
      );

      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .set('x-api-key', project.apiKey)
        .send({})
        .expect(400);
    });
  });

  // ─── POST /api/auth/logout ────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns success even for non-existent token (idempotent)', async () => {
      const { project } = await seedProjectSessionContext('E2E Logout Ghost');

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('x-api-key', project.apiKey)
        .send({ token: 'ghost-token-aabbcc' })
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });

    it('invalidates a valid existing token', async () => {
      const { bearerToken, project } =
        await seedProjectSessionContext('E2E Logout Valid');

      // Confirm it is valid first
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .set('x-api-key', project.apiKey)
        .send({ token: bearerToken })
        .expect(200);

      // Logout
      const logoutRes = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('x-api-key', project.apiKey)
        .send({ token: bearerToken })
        .expect(200);

      expect(logoutRes.body).toEqual({ success: true });

      // Now token should be invalid
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .set('x-api-key', project.apiKey)
        .send({ token: bearerToken })
        .expect(401);
    });
  });

  // ─── POST /api/auth/logout-all ────────────────────────────────

  describe('POST /api/auth/logout-all', () => {
    it('invalidates all sessions for a member', async () => {
      const { bearerToken, memberId, project } =
        await seedProjectSessionContext('E2E Logout All');

      await request(app.getHttpServer())
        .post('/api/auth/logout-all')
        .set('x-api-key', project.apiKey)
        .send({ memberId })
        .expect(200);

      // Original token should no longer be valid
      await request(app.getHttpServer())
        .post('/api/auth/validate')
        .set('x-api-key', project.apiKey)
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
        token: hashSessionToken('stale-token-cleanup-test'),
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/cleanup')
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });

    it('removes expired callback codes', async () => {
      const { memberId, serverId } = await seedAdminContext(db);
      const { id: projectId } = await seedTestProject(db, serverId, {
        name: 'E2E Cleanup CB',
      });

      // Insert an expired callback code
      await db.insert(callbackCodes).values({
        id: crypto.randomUUID(),
        codeHash: 'expired-hash-for-cleanup-test-0000000000000000',
        clientId: projectId,
        redirectUri: 'http://localhost:4000/callback',
        memberId,
        serverId,
        expiresAt: new Date(Date.now() - 1000),
        used: false,
      });

      await request(app.getHttpServer()).post('/api/auth/cleanup').expect(200);

      // Verify it was removed
      const rows = await db
        .select()
        .from(callbackCodes)
        .where(
          eq(
            callbackCodes.codeHash,
            'expired-hash-for-cleanup-test-0000000000000000',
          ),
        );
      expect(rows).toHaveLength(0);
    });
  });

  // ─── GET /api/auth/discord/callback (full flow) ─────────────

  describe('GET /api/auth/discord/callback', () => {
    const DISCORD_USER_ID = '800000000000000042';
    const DISCORD_USERNAME = 'oauth_e2e_user';
    const DISCORD_ROLE_ID = '700000000000000042';

    it('redirects to redirect_uri with ?code=...&state=...', async () => {
      const { serverId } = await seedAdminContext(db);
      const { id: projectId } = await seedTestProject(db, serverId, {
        name: 'E2E Callback Flow',
      });

      // Seed the Discord role in our DB so role sync works
      await db.insert(roles).values({
        id: DISCORD_ROLE_ID,
        serverId,
        name: 'E2E Role',
        color: 0x00ff00,
        hoist: false,
        position: 2,
        managed: false,
        mentionable: false,
      });

      // Step 1: GET /auth/authorize → sets cookie, redirects to /auth/discord
      const authorizeRes = await request(app.getHttpServer())
        .get('/api/auth/authorize')
        .query({
          client_id: projectId,
          redirect_uri: 'http://localhost:4000/callback',
          server_id: serverId,
          state: 'client-csrf-token',
        })
        .expect(302);

      const cookies = authorizeRes.headers['set-cookie'] as unknown as string[];
      const authCookie = cookies.find((c: string) =>
        c.startsWith('mcdi_auth_req='),
      )!;

      // Step 2: GET /auth/discord with cookie → redirects to Discord OAuth URL
      const discordRes = await request(app.getHttpServer())
        .get('/api/auth/discord')
        .set('Cookie', authCookie)
        .expect(302);

      // Extract the state token from the Discord redirect URL
      const discordUrl = new URL(discordRes.headers.location);
      const oauthState = discordUrl.searchParams.get('state')!;
      expect(oauthState).toBeTruthy();

      // Step 3: Mock all Discord API calls
      nock.cleanAll();
      mockDiscordToken('test-access-token-e2e');
      mockDiscordProfile({
        id: DISCORD_USER_ID,
        username: DISCORD_USERNAME,
        email: 'e2e@discord.test',
      });
      mockDiscordGuildMember(serverId, { roles: [DISCORD_ROLE_ID] });
      mockDiscordGuildRoles(serverId, [
        {
          id: DISCORD_ROLE_ID,
          name: 'E2E Role',
          color: 0x00ff00,
          position: 2,
        },
      ]);

      // Step 4: GET /auth/discord/callback → redirects to platform with code
      const callbackRes = await request(app.getHttpServer())
        .get('/api/auth/discord/callback')
        .query({ code: 'discord-auth-code-e2e', state: oauthState })
        .expect(302);

      const redirectUrl = new URL(callbackRes.headers.location);
      expect(redirectUrl.origin + redirectUrl.pathname).toBe(
        'http://localhost:4000/callback',
      );
      expect(redirectUrl.searchParams.get('code')).toBeTruthy();
      expect(redirectUrl.searchParams.get('code')!.length).toBe(64); // 32 bytes hex
      expect(redirectUrl.searchParams.get('state')).toBe('client-csrf-token');

      // Step 5: Verify the hash is stored in callback_codes
      const rawCode = redirectUrl.searchParams.get('code')!;
      const expectedHash = createHash('sha256').update(rawCode).digest('hex');

      const [row] = await db
        .select()
        .from(callbackCodes)
        .where(eq(callbackCodes.codeHash, expectedHash));

      expect(row).toBeDefined();
      expect(row.clientId).toBe(projectId);
      expect(row.memberId).toBe(DISCORD_USER_ID);
      expect(row.serverId).toBe(serverId);
      expect(row.redirectUri).toBe('http://localhost:4000/callback');
      expect(row.used).toBe(false);
      expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now());
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

  // ─── SSO endpoints ────────────────────────────────────────────

  describe('/api/auth/sso/*', () => {
    const seedSsoSession = async (memberId: string, rawToken: string) => {
      await db.insert(ssoSessions).values({
        memberId,
        tokenHash: hashSsoToken(rawToken),
        expiresAt: new Date(Date.now() + 3_600_000),
      });
    };

    describe('GET /api/auth/sso/session', () => {
      it('returns 401 + { authenticated: false } when the cookie is missing', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/auth/sso/session')
          .expect(401);
        expect(res.body).toEqual({ authenticated: false });
      });

      it('returns the authenticated member when the SSO cookie is valid', async () => {
        const { memberId } = await seedAdminContext(db);
        const rawToken = 'sso-status-token';
        await seedSsoSession(memberId, rawToken);

        const res = await request(app.getHttpServer())
          .get('/api/auth/sso/session')
          .set('Cookie', [`mcdi_sso=${rawToken}`])
          .expect(200);

        expect(res.body).toMatchObject({
          authenticated: true,
          member: {
            id: memberId,
            discordId: memberId,
            username: 'testadmin',
          },
        });
        expect(typeof res.body.expiresAt).toBe('string');
      });

      it('clears a stale cookie and reports unauthenticated', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/auth/sso/session')
          .set('Cookie', ['mcdi_sso=stale-token'])
          .expect(401);

        const setCookie = (res.headers['set-cookie'] as unknown as string[])
          ?.join(';')
          .toLowerCase();
        expect(setCookie).toContain('mcdi_sso=');
        expect(setCookie).toContain('expires=');
      });
    });

    describe('GET /api/auth/sso/authorize', () => {
      it('with a valid SSO cookie, skips Discord and redirects straight to the platform with a code', async () => {
        const { memberId, serverId } = await seedAdminContext(db);
        const project = await seedTestProject(db, serverId, {
          name: 'SSO Cross-Project',
        });
        const rawToken = 'sso-cross-token';
        await seedSsoSession(memberId, rawToken);

        const res = await request(app.getHttpServer())
          .get('/api/auth/sso/authorize')
          .query({
            client_id: project.id,
            redirect_uri: 'http://localhost:4000/callback',
            server_id: serverId,
            state: 'csrf-sso',
          })
          .set('Cookie', [`mcdi_sso=${rawToken}`])
          .expect(302);

        // Lands directly on the platform's redirect_uri carrying ?code=&state=,
        // never bouncing through Discord.
        const location = res.headers.location;
        expect(location).toContain('http://localhost:4000/callback');
        expect(location).toMatch(/[?&]code=/);
        expect(location).toContain('state=csrf-sso');
        expect(location).not.toContain('discord.com');
      });

      it('falls back to the Discord-OAuth flow when no SSO cookie is present', async () => {
        const { serverId } = await seedAdminContext(db);
        const project = await seedTestProject(db, serverId, {
          name: 'SSO Fallback',
        });

        const res = await request(app.getHttpServer())
          .get('/api/auth/sso/authorize')
          .query({
            client_id: project.id,
            redirect_uri: 'http://localhost:4000/callback',
            server_id: serverId,
            state: 'csrf-fallback',
          })
          .expect(302);

        // Same handoff as the existing /auth/authorize flow.
        expect(res.headers.location).toBe('/api/auth/discord');
        const cookie = (res.headers['set-cookie'] as unknown as string[]).find(
          (c) => c.startsWith('mcdi_auth_req='),
        );
        expect(cookie).toBeDefined();
      });
    });

    describe('GET /api/auth/sso/sessions', () => {
      it('lists active project sessions under the SSO cookie, hiding tokens', async () => {
        const { memberId, serverId } = await seedAdminContext(db);
        const project = await seedTestProject(db, serverId, {
          name: 'SSO List Project',
        });
        const rawToken = 'sso-list-token';
        await seedSsoSession(memberId, rawToken);

        await db.insert(sessions).values({
          id: crypto.randomUUID(),
          memberId,
          projectId: project.id,
          serverId,
          token: hashSessionToken('project-session-token'),
          expiresAt: new Date(Date.now() + 3_600_000),
        });

        const res = await request(app.getHttpServer())
          .get('/api/auth/sso/sessions')
          .set('Cookie', [`mcdi_sso=${rawToken}`])
          .expect(200);

        expect(Array.isArray(res.body.sessions)).toBe(true);
        const match = res.body.sessions.find(
          (s: { projectId: string }) => s.projectId === project.id,
        );
        expect(match).toMatchObject({
          projectId: project.id,
          projectName: 'SSO List Project',
          serverId,
        });
        for (const s of res.body.sessions) {
          expect(s).not.toHaveProperty('token');
          expect(s).not.toHaveProperty('tokenHash');
        }
      });

      it('returns 401 without an SSO cookie', async () => {
        await request(app.getHttpServer())
          .get('/api/auth/sso/sessions')
          .expect(401);
      });
    });

    describe('POST /api/auth/sso/logout', () => {
      it('cascades: destroys SSO + every project session and clears the cookie', async () => {
        const { memberId, serverId } = await seedAdminContext(db);
        const project = await seedTestProject(db, serverId, {
          name: 'SSO Logout Project',
        });
        const rawToken = 'sso-logout-token';
        await seedSsoSession(memberId, rawToken);

        await db.insert(sessions).values({
          id: crypto.randomUUID(),
          memberId,
          projectId: project.id,
          serverId,
          token: hashSessionToken('project-token-to-be-killed'),
          expiresAt: new Date(Date.now() + 3_600_000),
        });

        const res = await request(app.getHttpServer())
          .post('/api/auth/sso/logout')
          .set('Cookie', [`mcdi_sso=${rawToken}`])
          .expect(204);

        const setCookie = (res.headers['set-cookie'] as unknown as string[])
          ?.join(';')
          .toLowerCase();
        expect(setCookie).toContain('mcdi_sso=');

        // SSO row is gone
        const remainingSso = await db
          .select()
          .from(ssoSessions)
          .where(eq(ssoSessions.tokenHash, hashSsoToken(rawToken)));
        expect(remainingSso).toHaveLength(0);

        // Project sessions for this member are gone too
        const remainingSessions = await db
          .select()
          .from(sessions)
          .where(eq(sessions.memberId, memberId));
        expect(remainingSessions).toHaveLength(0);

        // The SSO endpoint now rejects the same cookie
        await request(app.getHttpServer())
          .get('/api/auth/sso/session')
          .set('Cookie', [`mcdi_sso=${rawToken}`])
          .expect(401);
      });

      it('is idempotent — succeeds with no cookie', async () => {
        await request(app.getHttpServer())
          .post('/api/auth/sso/logout')
          .expect(204);
      });
    });
  });

  // ─── GET /api/auth/admin/me ───────────────────────────────────

  describe('GET /api/auth/admin/me', () => {
    let adminMemberId: string;
    let sessionToken: string;

    beforeEach(async () => {
      const adminCtx = await seedAdminContext(db);
      adminMemberId = adminCtx.memberId;
      sessionToken = adminCtx.bearerToken;
    });

    it('returns the admin profile for a valid session token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', `Bearer ${sessionToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: adminMemberId,
        username: 'testadmin',
        isSystemAdmin: false,
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
        token: hashSessionToken(expiredToken),
        expiresAt: new Date(Date.now() - 60_000),
      });

      await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });
});
