import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ChannelAccessGuard } from '../channels/guards/channel-access.guard';
import { ProjectThrottlerGuard } from '../channels/guards/project-throttler.guard';

const WEBHOOK_ID = '11111111-1111-4111-8111-111111111111';

describe('WebhooksController (integration)', () => {
  let app: INestApplication;

  const mockService = {
    createWebhook: jest.fn(),
    listWebhooks: jest.fn(),
    getWebhook: jest.fn(),
    updateWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
    executeWebhook: jest.fn(),
  };

  const mockApiKeyGuard = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const req = context
        .switchToHttp()
        .getRequest<{ project?: { id: string } }>();
      req.project = { id: 'proj-1' };
      return true;
    }),
  };

  const mockChannelAccessGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  const mockProjectThrottlerGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhooksService,
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

  describe('POST /servers/:serverId/channels/:channelId/webhooks', () => {
    it('should return 201 with the created webhook', async () => {
      mockService.createWebhook.mockResolvedValue({
        id: WEBHOOK_ID,
        name: 'hook',
        channelId: 'ch-1',
        serverId: '123',
        projectId: 'proj-1',
        createdAt: '2025-01-15T14:30:00.000Z',
        usageCount: 0,
      });

      const res = await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/webhooks')
        .set('X-API-Key', 'test-key')
        .send({ name: 'hook' })
        .expect(201);

      expect(res.body.id).toBe(WEBHOOK_ID);
      expect(mockService.createWebhook).toHaveBeenCalledWith(
        '123',
        'ch-1',
        'proj-1',
        { name: 'hook' },
      );
    });

    it('should return 400 when the name is shorter than 2 chars', async () => {
      await request(app.getHttpServer())
        .post('/servers/123/channels/ch-1/webhooks')
        .set('X-API-Key', 'test-key')
        .send({ name: 'x' })
        .expect(400);
      expect(mockService.createWebhook).not.toHaveBeenCalled();
    });
  });

  describe('GET /projects/:projectId/webhooks', () => {
    it('should return 200 with the webhook list', async () => {
      mockService.listWebhooks.mockResolvedValue({
        webhooks: [
          {
            id: WEBHOOK_ID,
            name: 'hook',
            channelId: 'ch-1',
            channelName: null,
            serverId: '123',
            serverName: null,
            createdAt: '2025-01-15T14:30:00.000Z',
            usageCount: 0,
            lastUsedAt: null,
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      });

      const res = await request(app.getHttpServer())
        .get('/projects/proj-1/webhooks')
        .set('X-API-Key', 'test-key')
        .expect(200);

      expect(res.body.webhooks).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(mockService.listWebhooks).toHaveBeenCalledWith(
        'proj-1',
        'proj-1',
        { limit: 50, offset: 0 },
      );
    });
  });

  describe('GET /webhooks/:webhookId', () => {
    it('should return 200 with webhook details', async () => {
      mockService.getWebhook.mockResolvedValue({
        id: WEBHOOK_ID,
        name: 'hook',
        channelId: 'ch-1',
        channelName: 'general',
        serverId: '123',
        serverName: 'MicroClub',
        avatar: null,
        createdAt: '2025-01-15T14:30:00.000Z',
        usageCount: 0,
        lastUsedAt: null,
      });

      const res = await request(app.getHttpServer())
        .get(`/webhooks/${WEBHOOK_ID}`)
        .set('X-API-Key', 'test-key')
        .expect(200);

      expect(res.body.channelName).toBe('general');
      expect(mockService.getWebhook).toHaveBeenCalledWith(WEBHOOK_ID, 'proj-1');
    });

    it('tags a service NotFoundException as WEBHOOK_NOT_FOUND', async () => {
      mockService.getWebhook.mockRejectedValue(
        new NotFoundException({
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        }),
      );

      const res = await request(app.getHttpServer())
        .get(`/webhooks/${WEBHOOK_ID}`)
        .set('X-API-Key', 'test-key')
        .expect(404);

      expect(res.body.code).toBe('WEBHOOK_NOT_FOUND');
    });
  });

  describe('PATCH /webhooks/:webhookId', () => {
    it('should return 200 with the updated webhook', async () => {
      mockService.updateWebhook.mockResolvedValue({
        id: WEBHOOK_ID,
        name: 'renamed',
        channelId: 'ch-1',
        channelName: null,
        serverId: '123',
        serverName: null,
        avatar: null,
        createdAt: '2025-01-15T14:30:00.000Z',
        usageCount: 0,
        lastUsedAt: null,
      });

      const res = await request(app.getHttpServer())
        .patch(`/webhooks/${WEBHOOK_ID}`)
        .set('X-API-Key', 'test-key')
        .send({ name: 'renamed' })
        .expect(200);

      expect(res.body.name).toBe('renamed');
      expect(mockService.updateWebhook).toHaveBeenCalledWith(
        WEBHOOK_ID,
        'proj-1',
        { name: 'renamed' },
      );
    });

    it('should return 400 when the name is explicitly null', async () => {
      await request(app.getHttpServer())
        .patch(`/webhooks/${WEBHOOK_ID}`)
        .set('X-API-Key', 'test-key')
        .send({ name: null })
        .expect(400);
      expect(mockService.updateWebhook).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /webhooks/:webhookId', () => {
    it('should return 204 with no content', async () => {
      mockService.deleteWebhook.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .delete(`/webhooks/${WEBHOOK_ID}`)
        .set('X-API-Key', 'test-key')
        .expect(204);

      expect(res.body).toEqual({});
      expect(mockService.deleteWebhook).toHaveBeenCalledWith(
        WEBHOOK_ID,
        'proj-1',
      );
    });
  });

  describe('POST /webhooks/:webhookId/execute', () => {
    it('should return 204 after executing the webhook', async () => {
      mockService.executeWebhook.mockResolvedValue(undefined);

      const res = await request(app.getHttpServer())
        .post(`/webhooks/${WEBHOOK_ID}/execute`)
        .set('X-API-Key', 'test-key')
        .send({
          content: 'Deployment completed',
          username: 'Deployments',
          avatar_url: 'https://example.com/avatar.png',
        })
        .expect(204);

      expect(res.body).toEqual({});
      expect(mockService.executeWebhook).toHaveBeenCalledWith(
        WEBHOOK_ID,
        'proj-1',
        {
          content: 'Deployment completed',
          username: 'Deployments',
          avatar_url: 'https://example.com/avatar.png',
        },
      );
    });

    it('should reject content longer than 2000 characters', async () => {
      await request(app.getHttpServer())
        .post(`/webhooks/${WEBHOOK_ID}/execute`)
        .set('X-API-Key', 'test-key')
        .send({ content: 'x'.repeat(2001) })
        .expect(400);

      expect(mockService.executeWebhook).not.toHaveBeenCalled();
    });
  });
});
