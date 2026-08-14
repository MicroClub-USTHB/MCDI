import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ListChannelsQueryDto,
  ChannelTypeFilter,
} from './dto/list-channels-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { EmbedDto } from './dto/embed.dto';
import Discord, { ChannelType } from 'discord.js';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private readonly discordService: DiscordService) {}

  async sendMessage(
    serverId: string,
    channelId: string,
    dto: SendMessageDto,
  ): Promise<{
    id: string;
    channelId: string;
    content: string;
    timestamp: string;
    author: { id: string; username: string };
  }> {
    if (!dto.content?.length && !dto.embeds?.length) {
      throw new BadRequestException(
        'INVALID_CONTENT: Either content or embeds must be provided',
      );
    }

    const options: Discord.MessageCreateOptions = {};

    if (dto.content) {
      options.content = dto.content;
    }

    if (dto.embeds?.length) {
      options.embeds = dto.embeds.map((e) => this.buildEmbed(e));
    }

    if (dto.tts) {
      options.tts = true;
    }

    if (dto.allowed_mentions) {
      options.allowedMentions = {};
      if (dto.allowed_mentions.parse?.length) {
        options.allowedMentions.parse = dto.allowed_mentions.parse;
      }
      if (dto.allowed_mentions.users?.length) {
        options.allowedMentions.users = dto.allowed_mentions.users;
      }
      if (dto.allowed_mentions.roles?.length) {
        options.allowedMentions.roles = dto.allowed_mentions.roles;
      }
    }

    const message = await this.discordService.sendMessage(channelId, options);

    if (!message) {
      throw new NotFoundException(
        'CHANNEL_NOT_FOUND: Channel does not exist or bot lacks access',
      );
    }

    return {
      id: message.id,
      channelId: message.channelId,
      content: message.content,
      timestamp: message.createdAt.toISOString(),
      author: {
        id: message.author.id,
        username: message.author.username,
      },
    };
  }

  private buildEmbed(dto: EmbedDto): Discord.APIEmbed {
    const embed: Discord.APIEmbed = {};

    if (dto.title) embed.title = dto.title;
    if (dto.description) embed.description = dto.description;
    if (dto.url) embed.url = dto.url;
    if (dto.color !== undefined) embed.color = dto.color;

    if (dto.image) embed.image = { url: dto.image.url };
    if (dto.thumbnail) embed.thumbnail = { url: dto.thumbnail.url };

    if (dto.footer) {
      embed.footer = { text: dto.footer.text };
      if (dto.footer.icon_url) embed.footer.icon_url = dto.footer.icon_url;
    }

    if (dto.author) {
      embed.author = { name: dto.author.name };
      if (dto.author.url) embed.author.url = dto.author.url;
      if (dto.author.icon_url) embed.author.icon_url = dto.author.icon_url;
    }

    return embed;
  }

  private channelTypeToString(type: ChannelType): string {
    switch (type) {
      case ChannelType.GuildText:
        return 'text';
      case ChannelType.GuildVoice:
        return 'voice';
      case ChannelType.GuildAnnouncement:
        return 'announcement';
      case ChannelType.GuildCategory:
        return 'category';
      default:
        return 'unknown';
    }
  }

  async listChannels(serverId: string, query: ListChannelsQueryDto) {
    const channels = await this.discordService.getGuildChannels(serverId);

    if (!channels) {
      throw new NotFoundException('Server not found or bot not connected');
    }

    const channelEntries = [...channels.values()].filter(
      (ch): ch is Discord.NonThreadGuildBasedChannel => {
        if (!ch) return false;
        if (ch.isDMBased()) return false;

        if (query.type && query.type !== ChannelTypeFilter.ALL) {
          const typeStr = this.channelTypeToString(ch.type);
          if (typeStr !== (query.type as string)) return false;
        }

        if (query.categoryId && ch.parentId !== query.categoryId) {
          return false;
        }

        return true;
      },
    );

    const categories: {
      id: string;
      name: string;
      position: number;
      children: string[];
    }[] = [];

    const categoryMap = new Map<
      string,
      { id: string; name: string; position: number; children: string[] }
    >();

    const channelList = channelEntries.map((ch) => {
      const isCategory = ch.type === ChannelType.GuildCategory;

      if (isCategory) {
        const cat = {
          id: ch.id,
          name: ch.name,
          position: ch.position,
          children: [] as string[],
        };
        categoryMap.set(ch.id, cat);
        categories.push(cat);
      }

      return {
        id: ch.id,
        name: ch.name,
        type: this.channelTypeToString(ch.type),
        position: ch.position,
        parentId: ch.parentId ?? null,
        topic: 'topic' in ch ? (ch.topic ?? null) : null,
        nsfw: 'nsfw' in ch ? ch.nsfw : false,
        permissionOverwrites: {
          hasOverwrites: ch.permissionOverwrites.cache.size > 0,
        },
      };
    });

    for (const ch of channelEntries) {
      if (ch.parentId && categoryMap.has(ch.parentId)) {
        categoryMap.get(ch.parentId)!.children.push(ch.id);
      }
    }

    return { channels: channelList, categories };
  }

  async getChannel(serverId: string, channelId: string) {
    const channel = await this.discordService.getChannelById(channelId);

    if (!channel || channel.isDMBased()) {
      throw new NotFoundException(
        'CHANNEL_NOT_FOUND: Channel does not exist or bot lacks access',
      );
    }

    return {
      id: channel.id,
      name: 'name' in channel ? channel.name : 'Unknown',
      type: this.channelTypeToString(channel.type),
      position: 'position' in channel ? channel.position : 0,
      parentId: 'parentId' in channel ? (channel.parentId ?? null) : null,
      topic: 'topic' in channel ? (channel.topic ?? null) : null,
      nsfw: 'nsfw' in channel ? channel.nsfw : false,
      lastMessageId:
        'lastMessageId' in channel ? (channel.lastMessageId ?? null) : null,
      createdAt: channel.createdAt?.toISOString() ?? new Date().toISOString(),
    };
  }

  async getMessages(
    serverId: string,
    channelId: string,
    query: ListMessagesQueryDto,
  ) {
    const fetchOptions: Discord.FetchMessagesOptions = {
      limit: Math.min(query.limit ?? 50, 100),
    };

    if (query.before) fetchOptions.before = query.before;
    if (query.after) fetchOptions.after = query.after;

    const messages = await this.discordService.getChannelMessages(
      channelId,
      fetchOptions,
    );

    if (!messages) {
      throw new NotFoundException(
        'CHANNEL_NOT_FOUND: Channel does not exist or bot lacks access',
      );
    }

    const rawMessages = [...messages.values()];
    // hasMore reflects whether Discord's raw page was full, not the count
    // after client-side authorId filtering — otherwise filtering down to a
    // handful of matches would falsely report no more messages available.
    const hasMore = rawMessages.length === (query.limit ?? 50);

    let messageList = rawMessages;

    if (query.authorId) {
      messageList = messageList.filter(
        (msg) => msg.author.id === query.authorId,
      );
    }

    return {
      messages: messageList.map((msg) => ({
        id: msg.id,
        content: msg.content,
        author: {
          id: msg.author.id,
          username: msg.author.username,
          avatar: msg.author.avatar ?? null,
        },
        timestamp: msg.createdAt.toISOString(),
        embeds: msg.embeds.map((e) => ({
          title: e.title ?? null,
          description: e.description ?? null,
          url: e.url ?? null,
          color: e.color ?? null,
          type: String(e.data.type),
        })),
        attachments: msg.attachments.map((a) => ({
          id: a.id,
          url: a.url,
          filename: a.name,
          size: a.size,
        })),
        mentions: [
          ...[...msg.mentions.users.values()].map((u) => ({
            id: u.id,
            name: u.username,
          })),
          ...[...msg.mentions.roles.values()].map((r) => ({
            id: r.id,
            name: r.name,
          })),
        ],
      })),
      hasMore,
    };
  }
}
