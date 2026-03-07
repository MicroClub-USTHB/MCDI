import { Injectable } from '@nestjs/common';

export const DISCORD_HTTP_CLIENT = 'DISCORD_HTTP_CLIENT';

export interface DiscordHttpResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  text?: string;
}

export interface ExchangeCodePayload {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

export interface DiscordProfilePayload {
  id: string;
  username: string;
  global_name?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  email?: string | null;
}

export interface DiscordGuildMemberPayload {
  roles?: string[];
}

export interface DiscordGuildRolePayload {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface DiscordHttpClient {
  exchangeCodeForToken(
    payload: ExchangeCodePayload,
  ): Promise<DiscordHttpResult<{ access_token?: string }>>;
  fetchUserProfile(
    accessToken: string,
  ): Promise<DiscordHttpResult<DiscordProfilePayload>>;
  fetchGuildMember(
    serverId: string,
    accessToken: string,
  ): Promise<DiscordHttpResult<DiscordGuildMemberPayload>>;
  fetchGuildRoles(
    serverId: string,
    botToken: string,
  ): Promise<DiscordHttpResult<DiscordGuildRolePayload[]>>;
}

@Injectable()
export class FetchDiscordHttpClient implements DiscordHttpClient {
  async exchangeCodeForToken(
    payload: ExchangeCodePayload,
  ): Promise<DiscordHttpResult<{ access_token?: string }>> {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: payload.clientId,
        client_secret: payload.clientSecret,
        grant_type: 'authorization_code',
        code: payload.code,
        redirect_uri: payload.redirectUri,
      }),
    });

    return this.parseResponse<{ access_token?: string }>(response);
  }

  async fetchUserProfile(
    accessToken: string,
  ): Promise<DiscordHttpResult<DiscordProfilePayload>> {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return this.parseResponse<DiscordProfilePayload>(response);
  }

  async fetchGuildMember(
    serverId: string,
    accessToken: string,
  ): Promise<DiscordHttpResult<DiscordGuildMemberPayload>> {
    const response = await fetch(
      `https://discord.com/api/users/@me/guilds/${serverId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return this.parseResponse<DiscordGuildMemberPayload>(response);
  }

  async fetchGuildRoles(
    serverId: string,
    botToken: string,
  ): Promise<DiscordHttpResult<DiscordGuildRolePayload[]>> {
    const response = await fetch(
      `https://discord.com/api/guilds/${serverId}/roles`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );
    return this.parseResponse<DiscordGuildRolePayload[]>(response);
  }

  private async parseResponse<T>(
    response: Response,
  ): Promise<DiscordHttpResult<T>> {
    const text = await response.text().catch(() => '');
    let data: T | undefined;

    if (text) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = undefined;
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
      text,
    };
  }
}
