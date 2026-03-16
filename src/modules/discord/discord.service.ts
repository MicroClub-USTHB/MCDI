import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DISCORD_CLIENT } from './discord.constants';
import Discord from 'discord.js';

export interface DiscordOAuthProfile {
  id: string;
  username: string;
  global_name?: string | null;
  display_name?: string | null;
  avatar?: string | null;
  email?: string | null;
}

export interface OAuthGuildMemberResult {
  /** HTTP status returned by Discord (200, 403, 404, etc.) */
  status: number;
  /** Whether the user is confirmed to be in the guild. */
  ok: boolean;
  /** Discord role IDs held by the member in this guild. */
  roleIds: string[];
}

export interface DiscordGuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Discord.Client,
    private readonly configService: ConfigService,
  ) {}
  getClient(): Discord.Client {
    return this.client;
  }

  private isDmBasedChannel(
    channel: Discord.AnyChannel,
  ): channel is Discord.DMChannel | Discord.PartialDMChannel {
    return channel.type === 'DM' || channel.type === 'GROUP_DM';
  }

  private isGuildChannel(channel: Discord.AnyChannel): channel is Discord.GuildChannel {
    return 'guild' in channel;
  }

  private isTextBasedChannel(
    channel: Discord.AnyChannel,
  ): channel is Discord.TextBasedChannel {
    return 'messages' in channel;
  }

  private isWebhookCapableChannel(
    channel: Discord.AnyChannel,
  ): channel is Discord.TextBasedChannel {
    return (
      this.isTextBasedChannel(channel) &&
      !this.isDmBasedChannel(channel) &&
      !channel.isThread() &&
      channel.type !== 'GUILD_CATEGORY' &&
      'fetchWebhooks' in channel &&
      'createWebhook' in channel
    );
  }

  async getUserById(userId: string): Promise<Discord.User | null> {
    try {
      const user = await this.client.users.fetch(userId);
      return user;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getGuildById(guildId: string): Promise<Discord.Guild | null> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      return guild;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getGuildMember(
    guildId: string,
    userId: string,
  ): Promise<Discord.GuildMember | null> {
    try {
      const guild = await this.getGuildById(guildId);
      if (!guild) return null;
      const member = await guild.members.fetch(userId);
      return member;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getAllGuildMembers(
    guildId: string,
  ): Promise<Discord.Collection<string, Discord.GuildMember> | null> {
    try {
      const guild = await this.getGuildById(guildId);
      if (!guild) return null;
      const members = await guild.members.fetch();
      return members;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getChannelById(channelId: string): Promise<Discord.AnyChannel | null> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      return channel;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getGuildChannels(
    guildId: string,
  ): Promise<Discord.Collection<
    string,
    Discord.NonThreadGuildBasedChannel | null
  > | null> {
    try {
      const guild = await this.getGuildById(guildId);
      if (!guild) return null;
      const channels = await guild.channels.fetch();
      return channels;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async createChannel(
    guildId: string,
    name: string,
    options?: Discord.GuildChannelCreateOptions,
  ): Promise<Discord.GuildChannel | null> {
    try {
      const guild = await this.getGuildById(guildId);
      if (!guild) return null;
      const channel = await guild.channels.create(name, options);
      return channel;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || this.isDmBasedChannel(channel)) return false;
      await channel.delete();
      return true;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async editChannel(
    channelId: string,
    options: Discord.ChannelData,
  ): Promise<Discord.GuildBasedChannel | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || this.isDmBasedChannel(channel) || !this.isGuildChannel(channel)) {
        return null;
      }
      const editedChannel = await channel.edit(options);
      return editedChannel;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getChannelMessages(
    channelId: string,
    options?: Discord.ChannelLogsQueryOptions,
  ): Promise<Discord.Collection<string, Discord.Message> | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !this.isTextBasedChannel(channel)) return null;
      const messages = await channel.messages.fetch(options);
      return messages;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getMessageById(
    channelId: string,
    messageId: string,
  ): Promise<Discord.Message | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !this.isTextBasedChannel(channel)) return null;
      const message = await channel.messages.fetch(messageId);
      return message;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async bulkDeleteMessages(
    channelId: string,
    messages:
      | number
      | Discord.Collection<string, Discord.Message>
      | Discord.Message[]
      | string[],
    filterOld?: boolean,
  ) {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !this.isTextBasedChannel(channel) || this.isDmBasedChannel(channel))
        return null;
      const deletedMessages = await channel.bulkDelete(messages, filterOld);
      return deletedMessages;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async getRoleById(
    guildId: string,
    roleId: string,
  ): Promise<Discord.Role | null> {
    try {
      const guild = await this.getGuildById(guildId);
      if (!guild) return null;
      const role = await guild.roles.fetch(roleId);
      return role;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async addRoleToMember(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    try {
      const member = await this.getGuildMember(guildId, userId);
      if (!member) return false;
      await member.roles.add(roleId);
      return true;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async removeRoleFromMember(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    try {
      const member = await this.getGuildMember(guildId, userId);
      if (!member) return false;
      await member.roles.remove(roleId);
      return true;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async memberHasRole(
    guildId: string,
    userId: string,
    roleId: string,
  ): Promise<boolean> {
    try {
      const member = await this.getGuildMember(guildId, userId);
      if (!member) return false;
      return member.roles.cache.has(roleId);
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async sendMessage(
    channelId: string,
    content: string | Discord.MessageOptions,
  ): Promise<Discord.Message | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !this.isTextBasedChannel(channel)) return null;

      const message = await channel.send(content);
      return message;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async editMessage(
    channelId: string,
    messageId: string,
    content: string | Discord.MessageEditOptions,
  ): Promise<Discord.Message | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !this.isTextBasedChannel(channel)) return null;

      const message = await channel.messages.fetch(messageId);
      const editedMessage = await message.edit(content);
      return editedMessage;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }
  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
      const channel = await this.getChannelById(channelId);

      if (!channel || !this.isTextBasedChannel(channel)) return false;

      const message = await channel.messages.fetch(messageId);
      await message.delete();
      return true;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async getWebhooks(
    channelId: string,
  ): Promise<Discord.Collection<string, Discord.Webhook> | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !this.isWebhookCapableChannel(channel))
        return null;
      const webhooks = await channel.fetchWebhooks();
      return webhooks;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }
  async createWebhook(
    channelId: string,
    name: string,
    options?: Discord.ChannelWebhookCreateOptions,
  ): Promise<Discord.Webhook | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !this.isWebhookCapableChannel(channel))
        return null;
      const webhook = await channel.createWebhook({ name, ...options });
      return webhook;
    } catch (error: unknown) {
      this.logger.debug(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  // ─── OAuth2 / REST helpers (user-facing, not bot-client) ────────────────

  /**
   * Exchange a Discord authorization code for a user access token.
   * Uses the configured OAuth2 client credentials.
   * Returns the access token string, or null if the exchange fails.
   */
  async exchangeOAuthCode(
    code: string,
    redirectUri: string,
  ): Promise<string | null> {
    const clientId = this.configService.get<string>('discord.clientId')!;
    const clientSecret = this.configService.get<string>(
      'discord.clientSecret',
    )!;

    const res = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  /**
   * Fetch the authenticated user's Discord profile using their OAuth access token.
   * Returns the profile, or null if the request fails.
   */
  async fetchOAuthProfile(
    accessToken: string,
  ): Promise<DiscordOAuthProfile | null> {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;

    return res.json() as Promise<DiscordOAuthProfile>;
  }

  /**
   * Verify that a user is a member of a Discord guild via their OAuth access
   * token (requires `guilds.members.read` scope).
   * Returns membership status and the user's role IDs in that guild.
   */
  async fetchOAuthGuildMember(
    guildId: string,
    accessToken: string,
  ): Promise<OAuthGuildMemberResult> {
    const res = await fetch(
      `https://discord.com/api/users/@me/guilds/${guildId}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!res.ok) {
      return { status: res.status, ok: false, roleIds: [] };
    }

    const data = (await res.json()) as { roles?: string[] };
    return { status: res.status, ok: true, roleIds: data.roles ?? [] };
  }

  /**
   * Fetch all roles defined in a Discord guild via the bot token, then
   * filter to only those whose IDs appear in `memberRoleIds`.
   * Returns an empty array if the request fails.
   */
  async fetchGuildRolesForMember(
    guildId: string,
    memberRoleIds: string[],
  ): Promise<DiscordGuildRole[]> {
    if (memberRoleIds.length === 0) return [];

    const botToken = this.configService.get<string>('discord.token')!;

    const res = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (!res.ok) return [];

    const allRoles = (await res.json()) as DiscordGuildRole[];
    return allRoles.filter((r) => memberRoleIds.includes(r.id));
  }
}
