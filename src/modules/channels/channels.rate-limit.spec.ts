import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ChannelAccessGuard } from './guards/channel-access.guard';
import { ProjectThrottlerGuard } from './guards/project-throttler.guard';

describe('Channels Rate Limiting', () => {
  let app: INestApplication;

  const mockService = {
    sendMessage: jest.fn(),
    getMessages: jest.fn(),
    listChannels: jest.fn(),
    getChannel: jest.fn(),
  };

  const mockApiKeyGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  const mockChannelAccessGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      controllers: [ChannelsController],
      providers: [
        {
          provide: ChannelsService,
          useValue: mockService,
        },
        ProjectThrottlerGuard,
        Reflector,
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(mockApiKeyGuard)
      .overrideGuard(ChannelAccessGuard)
      .useValue(mockChannelAccessGuard)
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

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.sendMessage.mockResolvedValue({
      id: 'msg-1',
      channelId: 'ch-1',
      content: 'Hello',
      timestamp: '2025-01-15T14:30:00.000Z',
      author: { id: 'bot-1', username: 'TestBot' },
    });
  });

  it('should return 429 after 6th message send request', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/messages')
        .set('X-API-Key', 'test-key')
        .send({ content: `Message ${i}` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/servers/123/channels/ch-1/messages')
      .set('X-API-Key', 'test-key')
      .send({ content: 'Rate limited message' })
      .expect(429);
  });
});
