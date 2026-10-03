import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AdminWebhooksController } from './admin-webhooks.controller';
import { WebhooksService } from '../webhooks/webhooks.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const PROJECT_ID = '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d';
const WEBHOOK_ID = '11111111-1111-4111-8111-111111111111';

describe('AdminWebhooksController (integration)', () => {
  let app: INestApplication;

  const mockService = {
    listWebhooksForAdmin: jest.fn(),
    getWebhookForAdmin: jest.fn(),
    deleteWebhookForAdmin: jest.fn(),
  };

  const allow = { canActivate: jest.fn().mockResolvedValue(true) };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWebhooksController],
      providers: [{ provide: WebhooksService, useValue: mockService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue(allow)
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

  afterEach(() => jest.clearAllMocks());

  it('is guarded by SystemAdminGuard, not the project API key', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AdminWebhooksController,
    ) as unknown[];
    expect(guards).toEqual([SystemAdminGuard]);
  });

  describe('GET /admin/projects/:projectId/webhooks', () => {
    it("returns 200 with the project's webhooks and forwards the parsed query", async () => {
      mockService.listWebhooksForAdmin.mockResolvedValue({
        webhooks: [{ id: WEBHOOK_ID, usageCount: 3, lastUsedAt: null }],
        total: 1,
        limit: 10,
        offset: 0,
      });

      const res = await request(app.getHttpServer())
        .get(`/admin/projects/${PROJECT_ID}/webhooks?serverId=123&limit=10`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(mockService.listWebhooksForAdmin).toHaveBeenCalledWith(
        PROJECT_ID,
        { serverId: '123', limit: 10, offset: 0 },
      );
    });

    it('rejects a project id that is not a uuid with 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/projects/not-a-uuid/webhooks')
        .expect(400);

      expect(res.body.code).toBeDefined();
      expect(mockService.listWebhooksForAdmin).not.toHaveBeenCalled();
    });

    it('rejects an out-of-range limit with 400', async () => {
      await request(app.getHttpServer())
        .get(`/admin/projects/${PROJECT_ID}/webhooks?limit=500`)
        .expect(400);
      expect(mockService.listWebhooksForAdmin).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/webhooks/:webhookId', () => {
    it('returns 200 with the webhook detail', async () => {
      mockService.getWebhookForAdmin.mockResolvedValue({
        id: WEBHOOK_ID,
        name: 'deployments',
        avatar: null,
      });

      const res = await request(app.getHttpServer())
        .get(`/admin/webhooks/${WEBHOOK_ID}`)
        .expect(200);

      expect(res.body.name).toBe('deployments');
      expect(mockService.getWebhookForAdmin).toHaveBeenCalledWith(WEBHOOK_ID);
    });

    it('propagates a service NotFoundException as {statusCode, code, message}', async () => {
      mockService.getWebhookForAdmin.mockRejectedValue(
        new NotFoundException({
          code: 'WEBHOOK_NOT_FOUND',
          message: 'Webhook not found',
        }),
      );

      const res = await request(app.getHttpServer())
        .get(`/admin/webhooks/${WEBHOOK_ID}`)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        code: 'WEBHOOK_NOT_FOUND',
        message: 'Webhook not found',
      });
    });
  });

  describe('DELETE /admin/webhooks/:webhookId', () => {
    it('returns 204 and deletes through the service', async () => {
      mockService.deleteWebhookForAdmin.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete(`/admin/webhooks/${WEBHOOK_ID}`)
        .expect(204);

      expect(mockService.deleteWebhookForAdmin).toHaveBeenCalledWith(
        WEBHOOK_ID,
      );
    });
  });

  it('exposes no create, update or execute route', async () => {
    await request(app.getHttpServer())
      .patch(`/admin/webhooks/${WEBHOOK_ID}`)
      .send({ name: 'x' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/admin/webhooks/${WEBHOOK_ID}/execute`)
      .send({ content: 'x' })
      .expect(404);
  });
});
