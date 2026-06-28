import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ChannelAccessGuard } from './guards/channel-access.guard';
import { ProjectThrottlerGuard } from './guards/project-throttler.guard';

describe('ChannelsController (integration)', () => {
  let app: INestApplication;

  const mockService = {
    listChannels: jest.fn(),
    getChannel: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
  };

  const mockApiKeyGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  const mockChannelAccessGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  const mockProjectThrottlerGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        {
          provide: ChannelsService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(mockApiKeyGuard)
      .overrideGuard(ChannelAccessGuard)
      .useValue(mockChannelAccessGuard)
      .overrideGuard(ProjectThrottlerGuard)
      .useValue(mockProjectThrottlerGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /servers/:serverId/channels', () => {
    it('should return 200 with channels list', async () => {
      mockService.listChannels.mockResolvedValue({
        channels: [
          {
            id: 'ch-1',
            name: 'general',
            type: 'text',
            position: 0,
            parentId: null,
            topic: 'Discussion',
            nsfw: false,
            permissionOverwrites: { hasOverwrites: false },
          },
        ],
        categories: [],
      });

      const res = await request(app.getHttpServer())
        .get('/servers/123/channels')
        .set('X-API-Key', 'test-key')
        .expect(200);

      expect(res.body.channels).toHaveLength(1);
      expect(res.body.channels[0].name).toBe('general');
    });
  });

  describe('GET /servers/:serverId/channels/:channelId', () => {
    it('should return 200 with channel details', async () => {
      mockService.getChannel.mockResolvedValue({
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

      const res = await request(app.getHttpServer())
        .get('/servers/123/channels/ch-1')
        .set('X-API-Key', 'test-key')
        .expect(200);

      expect(res.body.id).toBe('ch-1');
      expect(res.body.type).toBe('text');
    });
  });

  describe('GET /servers/:serverId/channels/:channelId/messages', () => {
    it('should return 200 with messages', async () => {
      mockService.getMessages.mockResolvedValue({
        messages: [
          {
            id: 'msg-1',
            content: 'Hello!',
            author: { id: 'user-1', username: 'test', avatar: null },
            timestamp: '2025-01-15T14:30:00.000Z',
            embeds: [],
            attachments: [],
            mentions: [],
          },
        ],
        hasMore: false,
      });

      const res = await request(app.getHttpServer())
        .get('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .expect(200);

      expect(res.body.messages).toHaveLength(1);
      expect(res.body.hasMore).toBe(false);
    });
  });

  describe('POST /servers/:serverId/channels/:channelId/messages', () => {
    it('should return 201 with sent message', async () => {
      mockService.sendMessage.mockResolvedValue({
        id: 'msg-1',
        channelId: 'ch-1',
        content: 'Hello!',
        timestamp: '2025-01-15T14:30:00.000Z',
        author: { id: 'bot-1', username: 'TestBot' },
      });

      const res = await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .send({ content: 'Hello!' })
        .expect(201);

      expect(res.body.id).toBe('msg-1');
      expect(res.body.author.username).toBe('TestBot');
    });

    it('should return 400 when content exceeds 2000 chars', async () => {
      const longContent = 'x'.repeat(2001);

      await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .send({ content: longContent })
        .expect(400);
    });

    it('should return 400 when embed title exceeds 256 chars', async () => {
      await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .send({
          embeds: [{ title: 'x'.repeat(257), description: 'Test' }],
        })
        .expect(400);
    });

    it('should return 400 when embed description exceeds 4096 chars', async () => {
      await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .send({
          embeds: [{ title: 'Title', description: 'x'.repeat(4097) }],
        })
        .expect(400);
    });

    it('should return 400 when content is empty and no embeds provided', async () => {
      mockService.sendMessage.mockRejectedValue(
        new (require('@nestjs/common').BadRequestException)(
          'INVALID_CONTENT: Either content or embeds must be provided',
        ),
      );

      await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .send({})
        .expect(400);
    });

    it('should return 400 when embed color exceeds range', async () => {
      await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .send({
          content: 'Test',
          embeds: [{ title: 'Title', color: 16777216 }],
        })
        .expect(400);
    });
  });
});
