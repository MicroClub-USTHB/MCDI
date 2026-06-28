import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from './channels.service';
import { DiscordService } from '../discord/discord.service';
import { NotFoundException } from '@nestjs/common';
import { ChannelType } from 'discord.js';

describe('ChannelsService', () => {
  let service: ChannelsService;
  let discordService: jest.Mocked<DiscordService>;

  const mockDiscordService = {
    getGuildChannels: jest.fn(),
    getChannelById: jest.fn(),
    getChannelMessages: jest.fn(),
    sendMessage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        {
          provide: DiscordService,
          useValue: mockDiscordService,
        },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
    discordService = module.get(DiscordService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    const mockMessage = {
      id: 'msg-123',
      channelId: 'channel-123',
      content: 'Hello!',
      createdAt: new Date('2025-01-15T14:30:00.000Z'),
      author: { id: 'author-123', username: 'TestBot' },
    };

    it('should send a text message and return formatted response', async () => {
      mockDiscordService.sendMessage.mockResolvedValue(mockMessage);

      const result = await service.sendMessage('server-123', 'channel-123', {
        content: 'Hello!',
        tts: false,
      });

      expect(result).toEqual({
        id: 'msg-123',
        channelId: 'channel-123',
        content: 'Hello!',
        timestamp: '2025-01-15T14:30:00.000Z',
        author: { id: 'author-123', username: 'TestBot' },
      });
      expect(discordService.sendMessage).toHaveBeenCalledWith('channel-123', {
        content: 'Hello!',
      });
    });

    it('should send a message with embeds', async () => {
      mockDiscordService.sendMessage.mockResolvedValue(mockMessage);

      await service.sendMessage('server-123', 'channel-123', {
        embeds: [
          {
            title: 'Test Embed',
            description: 'Test description',
            color: 16711680,
          },
        ],
      });

      expect(discordService.sendMessage).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              title: 'Test Embed',
              description: 'Test description',
              color: 16711680,
            }),
          ],
        }),
      );
    });

    it('should send a message with allowed mentions', async () => {
      mockDiscordService.sendMessage.mockResolvedValue(mockMessage);

      await service.sendMessage('server-123', 'channel-123', {
        content: 'Hello @everyone',
        allowed_mentions: {
          parse: ['users'],
          users: ['user-123'],
        },
      });

      expect(discordService.sendMessage).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          content: 'Hello @everyone',
          allowedMentions: {
            parse: ['users'],
            users: ['user-123'],
          },
        }),
      );
    });

    it('should send a TTS message', async () => {
      mockDiscordService.sendMessage.mockResolvedValue(mockMessage);

      await service.sendMessage('server-123', 'channel-123', {
        content: 'Alert!',
        tts: true,
      });

      expect(discordService.sendMessage).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          content: 'Alert!',
          tts: true,
        }),
      );
    });

    it('should build full embed with all fields', async () => {
      mockDiscordService.sendMessage.mockResolvedValue(mockMessage);

      await service.sendMessage('server-123', 'channel-123', {
        embeds: [
          {
            title: 'Title',
            description: 'Desc',
            url: 'https://example.com',
            color: 65280,
            image: { url: 'https://example.com/image.png' },
            thumbnail: { url: 'https://example.com/thumb.png' },
            footer: {
              text: 'Footer',
              icon_url: 'https://example.com/favicon.ico',
            },
            author: {
              name: 'Author',
              url: 'https://example.com',
              icon_url: 'https://example.com/avatar.png',
            },
          },
        ],
      });

      expect(discordService.sendMessage).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          embeds: [
            expect.objectContaining({
              title: 'Title',
              description: 'Desc',
              url: 'https://example.com',
              color: 65280,
              image: { url: 'https://example.com/image.png' },
              thumbnail: { url: 'https://example.com/thumb.png' },
              footer: {
                text: 'Footer',
                icon_url: 'https://example.com/favicon.ico',
              },
              author: {
                name: 'Author',
                url: 'https://example.com',
                icon_url: 'https://example.com/avatar.png',
              },
            }),
          ],
        }),
      );
    });

    it('should throw NotFoundException when channel is not found', async () => {
      mockDiscordService.sendMessage.mockResolvedValue(null);

      await expect(
        service.sendMessage('server-123', 'channel-123', {
          content: 'Hello',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listChannels', () => {
    it('should return channels grouped with categories', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Text Channels',
        type: ChannelType.GuildCategory,
        position: 0,
        parentId: null,
        permissionOverwrites: { cache: { size: 0 } },
        isDMBased: () => false,
      };

      const mockTextChannel: any = {
        id: 'ch-1',
        name: 'general',
        type: ChannelType.GuildText,
        position: 1,
        parentId: 'cat-1',
        topic: 'General discussion',
        nsfw: false,
        permissionOverwrites: { cache: { size: 0 } },
        isDMBased: () => false,
      };

      mockDiscordService.getGuildChannels.mockResolvedValue(
        new Map([
          ['cat-1', mockCategory],
          ['ch-1', mockTextChannel],
        ]) as any,
      );

      const result = await service.listChannels('server-123', { type: 'all' });

      expect(result.channels).toHaveLength(2);
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].children).toContain('ch-1');
    });

    it('should filter channels by type', async () => {
      const mockVoiceChannel: any = {
        id: 'vc-1',
        name: 'Voice',
        type: ChannelType.GuildVoice,
        position: 0,
        parentId: null,
        permissionOverwrites: { cache: { size: 0 } },
        isDMBased: () => false,
      };

      mockDiscordService.getGuildChannels.mockResolvedValue(
        new Map([['vc-1', mockVoiceChannel]]) as any,
      );

      const result = await service.listChannels('server-123', {
        type: 'voice' as any,
      });

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].type).toBe('voice');
    });

    it('should filter channels by category', async () => {
      const mockChannel: any = {
        id: 'ch-1',
        name: 'general',
        type: ChannelType.GuildText,
        position: 0,
        parentId: 'cat-1',
        topic: null,
        nsfw: false,
        permissionOverwrites: { cache: { size: 0 } },
        isDMBased: () => false,
      };
      const mockOtherChannel: any = {
        id: 'ch-2',
        name: 'other',
        type: ChannelType.GuildText,
        position: 1,
        parentId: 'cat-2',
        topic: null,
        nsfw: false,
        permissionOverwrites: { cache: { size: 0 } },
        isDMBased: () => false,
      };

      mockDiscordService.getGuildChannels.mockResolvedValue(
        new Map([
          ['ch-1', mockChannel],
          ['ch-2', mockOtherChannel],
        ]) as any,
      );

      const result = await service.listChannels('server-123', {
        categoryId: 'cat-1',
      });

      expect(result.channels).toHaveLength(1);
      expect(result.channels[0].id).toBe('ch-1');
    });

    it('should throw NotFoundException when guild not found', async () => {
      mockDiscordService.getGuildChannels.mockResolvedValue(null);

      await expect(
        service.listChannels('server-123', { type: 'all' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getChannel', () => {
    it('should return formatted channel details', async () => {
      const mockChannel: any = {
        id: 'ch-1',
        name: 'general',
        type: ChannelType.GuildText,
        position: 0,
        parentId: null,
        topic: 'Discussion',
        nsfw: false,
        lastMessageId: 'msg-123',
        createdAt: new Date('2025-01-15T14:30:00.000Z'),
        isDMBased: () => false,
      };

      mockDiscordService.getChannelById.mockResolvedValue(mockChannel);

      const result = await service.getChannel('server-123', 'ch-1');

      expect(result).toEqual({
        id: 'ch-1',
        name: 'general',
        type: 'text',
        position: 0,
        parentId: null,
        topic: 'Discussion',
        nsfw: false,
        lastMessageId: 'msg-123',
        createdAt: '2025-01-15T14:30:00.000Z',
      });
    });

    it('should throw NotFoundException when channel not found', async () => {
      mockDiscordService.getChannelById.mockResolvedValue(null);

      await expect(service.getChannel('server-123', 'ch-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for DM channels', async () => {
      mockDiscordService.getChannelById.mockResolvedValue({
        isDMBased: () => true,
      } as any);

      await expect(
        service.getChannel('server-123', 'dm-channel'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMessages', () => {
    const buildMockMessage = (
      id: string,
      authorId: string,
      content: string,
    ) => ({
      id,
      content,
      author: { id: authorId, username: `user-${authorId}`, avatar: null },
      createdAt: new Date('2025-01-15T14:30:00.000Z'),
      embeds: [],
      attachments: [],
      mentions: { users: new Map(), roles: new Map() },
    });

    it('should return messages with hasMore flag', async () => {
      const mockMessages = new Map([
        ['1', buildMockMessage('1', 'user-1', 'Hello')],
        ['2', buildMockMessage('2', 'user-2', 'World')],
      ]);

      mockDiscordService.getChannelMessages.mockResolvedValue(
        mockMessages as any,
      );

      const result = await service.getMessages('server-123', 'channel-123', {
        limit: 50,
      });

      expect(result.messages).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should set hasMore=true when result count equals limit', async () => {
      const messages = new Map();
      for (let i = 0; i < 50; i++) {
        const id = String(i);
        messages.set(id, buildMockMessage(id, 'user-1', `msg-${i}`));
      }

      mockDiscordService.getChannelMessages.mockResolvedValue(messages as any);

      const result = await service.getMessages('server-123', 'channel-123', {
        limit: 50,
      });

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });

    it('should filter messages by authorId', async () => {
      const mockMessages = new Map([
        ['1', buildMockMessage('1', 'author-a', 'From A')],
        ['2', buildMockMessage('2', 'author-b', 'From B')],
        ['3', buildMockMessage('3', 'author-a', 'Also from A')],
      ]);

      mockDiscordService.getChannelMessages.mockResolvedValue(
        mockMessages as any,
      );

      const result = await service.getMessages('server-123', 'channel-123', {
        authorId: 'author-a',
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages.every((m) => m.author.id === 'author-a')).toBe(
        true,
      );
    });

    it('should pass before/after pagination to Discord service', async () => {
      mockDiscordService.getChannelMessages.mockResolvedValue(new Map() as any);

      await service.getMessages('server-123', 'channel-123', {
        before: 'msg-100',
        after: 'msg-50',
        limit: 25,
      });

      expect(discordService.getChannelMessages).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          before: 'msg-100',
          after: 'msg-50',
          limit: 25,
        }),
      );
    });

    it('should throw NotFoundException when channel not found', async () => {
      mockDiscordService.getChannelMessages.mockResolvedValue(null);

      await expect(
        service.getMessages('server-123', 'channel-123', { limit: 50 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
