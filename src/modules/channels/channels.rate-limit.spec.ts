import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ChannelAccessGuard } from './guards/channel-access.guard';

@Injectable()
class MockRateLimiter implements CanActivate {
  private counts = new Map<string, number>();
  private readonly limit = 5;

  reset(): void {
    this.counts.clear();
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = `${req.method}:${req.path}`;

    const count = this.counts.get(key) ?? 0;
    this.counts.set(key, count + 1);

    if (count >= this.limit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'RATE_LIMITED: Rate limit exceeded, retry after 60 seconds',
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

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

  let rateLimiter: MockRateLimiter;

  beforeAll(async () => {
    rateLimiter = new MockRateLimiter();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [
        {
          provide: ChannelsService,
          useValue: mockService,
        },
        {
          provide: APP_GUARD,
          useValue: rateLimiter,
        },
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
    rateLimiter.reset();
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
