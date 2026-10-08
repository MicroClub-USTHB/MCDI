/**
 * E2E: admin CLI login (m-forge) — loopback redirect (RFC 8252) + PKCE (RFC 7636).
 *
 * GET /api/auth/admin/discord?redirect_uri=&code_challenge=&code_challenge_method=S256
 *   → Discord (mocked with nock) → admin callback → 302 to the CLI's loopback URL
 *   with ?code=&state= → POST /api/auth/admin/token { code, codeVerifier } → session.
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`). Uses its own main
 * guild id, so it does not depend on the `MC_GUILD_ID` secret.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { createTestApp } from './helpers/create-app';
import { clearAllTables, closeTestDb, getTestDb, TestDb } from './helpers/db';
import {
  disableNock,
  enableNock,
  mockDiscordGuildMember,
  mockDiscordGuildMemberNotFound,
  mockDiscordGuildRoles,
  mockDiscordProfile,
  mockDiscordToken,
} from './helpers/discord-mock';
import { adminCliCodes, servers, sessions } from '../src/database/entities';
import { hashSessionToken } from '../src/common/utils/session-token.util';

const LOOPBACK = 'http://127.0.0.1:53123/callback';
const EXECUTIVE_ROLE_ID = '700000000000000001'; // set by createTestApp
const ADMIN_DISCORD_ID = '900000000000000001';
const MAIN_GUILD_ID = '800000000000000099';

const pkcePair = () => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256')
    .update(verifier, 'ascii')
    .digest('base64url');
  return { verifier, challenge };
};

describe('Admin CLI login (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  const guildId = () => MAIN_GUILD_ID;
  const previousGuildId = process.env.MC_GUILD_ID;

  beforeAll(async () => {
    // The admin login requires a main guild; set one here instead of relying on
    // the MC_GUILD_ID secret, which CI doesn't expose to pull requests from forks.
    process.env.MC_GUILD_ID = MAIN_GUILD_ID;
    enableNock();
    db = getTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    disableNock();
    await closeTestDb();
    await app.close();
    if (previousGuildId === undefined) delete process.env.MC_GUILD_ID;
    else process.env.MC_GUILD_ID = previousGuildId;
  });

  beforeEach(async () => {
    await clearAllTables(db);
    // The main guild row DatabaseInitService bootstraps in production.
    await db.insert(servers).values({
      id: guildId(),
      name: 'Main Server',
      isMain: true,
      isActive: true,
      type: 'club',
    });
  });

  /** Starts a CLI login and returns the state MCDI put in the Discord URL. */
  const startCliLogin = async (challenge: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/admin/discord')
      .query({
        redirect_uri: LOOPBACK,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      .set('Accept', 'application/json')
      .expect(200);
    const state = new URL(res.body.url).searchParams.get('state');
    expect(state).toBeTruthy();
    return state!;
  };

  /** What Discord does after consent, for a member holding `roleIds`. */
  const mockDiscordConsent = (roleIds: string[]) => {
    mockDiscordToken('cli-discord-access-token');
    mockDiscordProfile({ id: ADMIN_DISCORD_ID, username: 'cliadmin' });
    mockDiscordGuildMember(guildId(), { roles: roleIds });
    mockDiscordGuildRoles(guildId(), [
      { id: EXECUTIVE_ROLE_ID, name: 'Executive', color: 0, position: 1 },
    ]);
  };

  const callback = (path: string, state: string) =>
    request(app.getHttpServer())
      .get(path)
      .query({ code: 'discord-code', state })
      .expect(302);

  it.each(['/api/auth/admin/discord/callback', '/api/auth/discord/callback'])(
    'logs in end to end through %s: loopback code, PKCE exchange, working session',
    async (callbackPath) => {
      const { verifier, challenge } = pkcePair();
      const state = await startCliLogin(challenge);
      mockDiscordConsent([EXECUTIVE_ROLE_ID]);

      // Discord → MCDI → back to the CLI's loopback URL, never a cookie.
      const res = await callback(callbackPath, state);
      const target = new URL(res.headers.location);
      expect(target.origin + target.pathname).toBe(LOOPBACK);
      expect(target.searchParams.get('state')).toBe(state);
      const code = target.searchParams.get('code')!;
      expect(target.searchParams.get('error')).toBeNull();
      expect(code).toBeTruthy();
      expect(String(res.headers['set-cookie'] ?? '')).not.toContain(
        'admin_session',
      );

      // Only the code's hash is stored, and no session exists yet.
      const [row] = await db.select().from(adminCliCodes);
      expect(row.codeHash).toBe(
        createHash('sha256').update(code).digest('hex'),
      );
      expect(row.codeHash).not.toBe(code);
      expect(await db.select().from(sessions)).toHaveLength(0);

      // The CLI exchanges the code with its PKCE verifier.
      const token = await request(app.getHttpServer())
        .post('/api/auth/admin/token')
        .send({ code, codeVerifier: verifier })
        .expect(200);
      expect(typeof token.body.token).toBe('string');
      expect(new Date(token.body.expiresAt).getTime()).toBeGreaterThan(
        Date.now() + 23 * 3600_000,
      );
      const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.token, hashSessionToken(token.body.token)));
      expect(session.memberId).toBe(ADMIN_DISCORD_ID);

      // The session works like a web panel one.
      const me = await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', `Bearer ${token.body.token}`)
        .expect(200);
      expect(me.body).toMatchObject({
        id: ADMIN_DISCORD_ID,
        username: 'cliadmin',
      });

      // A code works once.
      await request(app.getHttpServer())
        .post('/api/auth/admin/token')
        .send({ code, codeVerifier: verifier })
        .expect(401);
    },
  );

  it('refuses a wrong PKCE verifier, and the code is burnt afterwards', async () => {
    const { verifier, challenge } = pkcePair();
    const state = await startCliLogin(challenge);
    mockDiscordConsent([EXECUTIVE_ROLE_ID]);
    const res = await callback('/api/auth/admin/discord/callback', state);
    const code = new URL(res.headers.location).searchParams.get('code')!;

    const wrong = await request(app.getHttpServer())
      .post('/api/auth/admin/token')
      .send({ code, codeVerifier: pkcePair().verifier })
      .expect(401);
    expect(wrong.body.message).toBe('Invalid or expired login code');

    // An intercepted code can't be retried with the right verifier either.
    await request(app.getHttpServer())
      .post('/api/auth/admin/token')
      .send({ code, codeVerifier: verifier })
      .expect(401);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it('refuses an expired code', async () => {
    const { verifier, challenge } = pkcePair();
    const state = await startCliLogin(challenge);
    mockDiscordConsent([EXECUTIVE_ROLE_ID]);
    const res = await callback('/api/auth/admin/discord/callback', state);
    const code = new URL(res.headers.location).searchParams.get('code')!;
    await db
      .update(adminCliCodes)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    await request(app.getHttpServer())
      .post('/api/auth/admin/token')
      .send({ code, codeVerifier: verifier })
      .expect(401);
  });

  it('hands a refusal (not a member of the main guild) back to the CLI as ?error=&state=', async () => {
    const { challenge } = pkcePair();
    const state = await startCliLogin(challenge);
    mockDiscordToken('cli-discord-access-token');
    mockDiscordProfile({ id: ADMIN_DISCORD_ID, username: 'cliadmin' });
    mockDiscordGuildMemberNotFound(guildId());

    const res = await callback('/api/auth/admin/discord/callback', state);
    const target = new URL(res.headers.location);

    expect(target.origin + target.pathname).toBe(LOOPBACK);
    expect(target.searchParams.get('state')).toBe(state);
    expect(target.searchParams.get('error')).toBe(
      'You must be a member of the main MCDI Discord server to access the admin panel',
    );
    expect(target.searchParams.has('code')).toBe(false);
    expect(await db.select().from(adminCliCodes)).toHaveLength(0);
  });

  it('keeps the web panel login on a cookie and the admin frontend', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/admin/discord')
      .set('Accept', 'application/json')
      .expect(200);
    const state = new URL(res.body.url).searchParams.get('state')!;
    mockDiscordConsent([EXECUTIVE_ROLE_ID]);

    const cb = await callback('/api/auth/admin/discord/callback', state);

    expect(cb.headers.location).not.toContain('127.0.0.1:53123');
    expect(String(cb.headers['set-cookie'])).toContain('admin_session=');
    expect(await db.select().from(adminCliCodes)).toHaveLength(0);
  });

  describe('validation', () => {
    const { challenge } = pkcePair();

    it.each([
      ['a non-loopback redirect', { redirect_uri: 'https://evil.example/cb' }],
      ['a LAN redirect', { redirect_uri: 'http://192.168.1.5:5000/cb' }],
      ['a missing challenge', { code_challenge: undefined }],
      ['the plain method', { code_challenge_method: 'plain' }],
      ['an unknown query parameter', { scope: 'everything' }],
    ])('rejects %s with 400', async (_name, override) => {
      const query: Record<string, string | undefined> = {
        redirect_uri: LOOPBACK,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        ...override,
      };
      for (const key of Object.keys(query)) {
        if (query[key] === undefined) delete query[key];
      }
      await request(app.getHttpServer())
        .get('/api/auth/admin/discord')
        .query(query)
        .set('Accept', 'application/json')
        .expect(400);
    });

    it.each([
      ['no body', {}],
      ['no verifier', { code: 'abc' }],
      ['an extra field', { code: 'abc', codeVerifier: 'x', admin: true }],
    ])('rejects a token request with %s with 400', async (_name, body) => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/token')
        .send(body)
        .expect(400);
    });

    it('rejects an unknown code with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/admin/token')
        .send({ code: 'never-issued', codeVerifier: pkcePair().verifier })
        .expect(401);
    });
  });
});
