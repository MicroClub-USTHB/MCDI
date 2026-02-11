import { Inject, Injectable } from '@nestjs/common';
import { DISCORD_CLIENT } from './discord.constants';
import Discord, { ChannelType } from 'discord.js';

@Injectable()
export class DiscordService {
  constructor(
    @Inject(DISCORD_CLIENT) private readonly client: Discord.Client,
  ) {}
  getClient(): Discord.Client {
    return this.client;
  }

  async getUserById(userId: string): Promise<Discord.User | null> {
    try {
      const user = await this.client.users.fetch(userId);
      return user;
    } catch {
      return null;
    }
  }

  async getGuildById(guildId: string): Promise<Discord.Guild | null> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      return guild;
    } catch {
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
    } catch {
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
    } catch {
      return null;
    }
  }

  async getChannelById(channelId: string): Promise<Discord.Channel | null> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      return channel;
    } catch {
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
    } catch {
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
      const channel = await guild.channels.create({ name, ...options });
      return channel;
    } catch {
      return null;
    }
  }

  async deleteChannel(channelId: string): Promise<boolean> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || channel.isDMBased()) return false;
      await channel.delete();
      return true;
    } catch {
      return false;
    }
  }

  async editChannel(
    channelId: string,
    options: Discord.GuildChannelEditOptions,
  ): Promise<Discord.GuildBasedChannel | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || channel.isDMBased()) return null;
      const editedChannel = await channel.edit(options);
      return editedChannel;
    } catch {
      return null;
    }
  }

  async getChannelMessages(
    channelId: string,
    options?: Discord.FetchMessagesOptions,
  ): Promise<Discord.Collection<string, Discord.Message> | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !channel.isTextBased()) return null;
      const messages = await channel.messages.fetch(options);
      return messages;
    } catch {
      return null;
    }
  }

  async getMessageById(
    channelId: string,
    messageId: string,
  ): Promise<Discord.Message | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !channel.isTextBased()) return null;
      const message = await channel.messages.fetch(messageId);
      return message;
    } catch {
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
      if (!channel || !channel.isTextBased() || channel.isDMBased())
        return null;
      const deletedMessages = await channel.bulkDelete(messages, filterOld);
      return deletedMessages;
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      return false;
    }
  }

  async sendMessage(
    channelId: string,
    content: string | Discord.MessageCreateOptions,
  ): Promise<Discord.Message | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (!channel || !channel.isSendable()) return null;

      const message = await channel.send(content);
      return message;
    } catch {
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
      if (!channel || !channel.isSendable()) return null;

      const message = await channel.messages.fetch(messageId);
      const editedMessage = await message.edit(content);
      return editedMessage;
    } catch {
      return null;
    }
  }
  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
      const channel = await this.getChannelById(channelId);

      if (!channel || !channel.isSendable()) return false;

      const message = await channel.messages.fetch(messageId);
      await message.delete();
      return true;
    } catch {
      return false;
    }
  }

  async getWebhooks(
    channelId: string,
  ): Promise<Discord.Collection<string, Discord.Webhook> | null> {
    try {
      const channel = await this.getChannelById(channelId);
      if (
        !channel ||
        channel.isDMBased() ||
        channel.isThread() ||
        channel.type === ChannelType.GuildCategory
      )
        return null;
      const webhooks = await channel.fetchWebhooks();
      return webhooks;
    } catch {
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
      if (
        !channel ||
        channel.isDMBased() ||
        channel.isThread() ||
        channel.type === ChannelType.GuildCategory
      )
        return null;
      const webhook = await channel.createWebhook({ name, ...options });
      return webhook;
    } catch {
      return null;
    }
  }
}
