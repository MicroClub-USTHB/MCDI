/**
 * nock interceptors for Discord REST API calls made during the OAuth flow.
 *
 * Usage in tests:
 *   import { mockDiscordToken, mockDiscordProfile, mockDiscordGuildMember, mockDiscordGuildRoles } from './helpers/discord-mock';
 *
 *   beforeEach(() => {
 *     nock.cleanAll();
 *     mockDiscordToken('access-token-abc');
 *     mockDiscordProfile({ id: '123', username: 'testuser', ... });
 *     mockDiscordGuildMember('guild-id', { roles: ['role-id-1'] });
 *     mockDiscordGuildRoles('guild-id', [{ id: 'role-id-1', name: 'Member', color: 0, position: 1 }]);
 *   });
 *
 *   afterAll(() => nock.cleanAll());
 */
import nock from 'nock';

const DISCORD_BASE = 'https://discord.com';

export interface DiscordTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/** Intercepts `POST /api/oauth2/token` — Discord code exchange. */
export function mockDiscordToken(
  accessToken = 'test-discord-access-token',
): nock.Scope {
  return nock(DISCORD_BASE)
    .post('/api/oauth2/token')
    .reply(200, {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 604800,
      refresh_token: 'test-refresh-token',
      scope: 'identify email guilds.members.read',
    } satisfies DiscordTokenResponse);
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  email?: string | null;
  verified?: boolean;
}

/** Intercepts `GET /api/users/@me` — Discord user profile fetch. */
export function mockDiscordProfile(
  user: Partial<DiscordUser> & { id: string; username: string },
): nock.Scope {
  return nock(DISCORD_BASE)
    .get('/api/users/@me')
    .reply(200, {
      global_name: null,
      display_name: null,
      avatar: null,
      email: 'user@discord.test',
      verified: true,
      ...user,
    } satisfies DiscordUser);
}

export interface DiscordGuildMember {
  roles: string[];
  nick?: string | null;
  joined_at?: string;
}

/** Intercepts `GET /api/users/@me/guilds/{guildId}/member`. */
export function mockDiscordGuildMember(
  guildId: string,
  member: Partial<DiscordGuildMember> = {},
): nock.Scope {
  return nock(DISCORD_BASE)
    .get(`/api/users/@me/guilds/${guildId}/member`)
    .reply(200, {
      roles: [],
      nick: null,
      joined_at: new Date().toISOString(),
      ...member,
    } satisfies DiscordGuildMember);
}

/** Responds 404 guild member (user not in server). */
export function mockDiscordGuildMemberNotFound(guildId: string): nock.Scope {
  return nock(DISCORD_BASE)
    .get(`/api/users/@me/guilds/${guildId}/member`)
    .reply(404, { message: '10004: Unknown Guild' });
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

/** Intercepts `GET /api/guilds/{guildId}/roles` (Bot token call). */
export function mockDiscordGuildRoles(
  guildId: string,
  roles: DiscordRole[] = [],
): nock.Scope {
  return nock(DISCORD_BASE)
    .get(`/api/guilds/${guildId}/roles`)
    .reply(200, roles);
}

/** Enables nock to intercept outbound HTTP requests. Call once in a describe block. */
export function enableNock(): void {
  nock.disableNetConnect();
  // Allow supertest connections to localhost
  nock.enableNetConnect('127.0.0.1');
}

/** Restores nock state. Call in afterAll. */
export function disableNock(): void {
  nock.cleanAll();
  nock.enableNetConnect();
}
