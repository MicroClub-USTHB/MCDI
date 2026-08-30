import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ChannelAccessGuard } from '../channels/guards/channel-access.guard';
import { ProjectThrottlerGuard } from '../channels/guards/project-throttler.guard';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

const WEBHOOK_ID = '11111111-1111-4111-8111-111111111111';

describe('Webhooks execution rate limit', () => {
  let app: INestApplication;

  const service = {
    executeWebhook: jest.fn().mockResolvedValue(undefined),
  };

  const apiKeyGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<{
        headers: Record<string, string | undefined>;
        project?: { id: string };
      }>();
      req.project = { id: req.headers['x-project-id'] ?? 'proj-1' };
      return true;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
      controllers: [WebhooksController],
      providers: [
        { provide: WebhooksService, useValue: service },
        ProjectThrottlerGuard,
        Reflector,
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue(apiKeyGuard)
      .overrideGuard(ChannelAccessGuard)
      .useValue({ canActivate: () => true })
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

  it('limits each project to 30 executions per minute', async () => {
    const endpoint = `/webhooks/${WEBHOOK_ID}/execute`;

    for (let requestNumber = 0; requestNumber < 30; requestNumber++) {
      await request(app.getHttpServer())
        .post(endpoint)
        .set('X-API-Key', 'test-key')
        .set('X-Project-Id', 'proj-1')
        .send({ content: `Message ${requestNumber}` })
        .expect(204);
    }

    const limited = await request(app.getHttpServer())
      .post(endpoint)
      .set('X-API-Key', 'test-key')
      .set('X-Project-Id', 'proj-1')
      .send({ content: 'Message 31' })
      .expect(429);

    expect(limited.body.code).toBe('RATE_LIMITED');

    await request(app.getHttpServer())
      .post(endpoint)
      .set('X-API-Key', 'test-key')
      .set('X-Project-Id', 'proj-2')
      .send({ content: 'Another project' })
      .expect(204);
  });
});
