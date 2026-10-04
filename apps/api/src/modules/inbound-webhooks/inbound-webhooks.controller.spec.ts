import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { InboundWebhooksController } from './inbound-webhooks.controller';
import { InboundWebhooksService } from './inbound-webhooks.service';

const ROLE = '700000000000000001';

describe('InboundWebhooksController settings routes', () => {
  let app: INestApplication;
  const service = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    findById: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InboundWebhooksController],
      providers: [{ provide: InboundWebhooksService, useValue: service }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => Record<string, unknown> };
        }) => {
          context.switchToHttp().getRequest().memberId = 'admin-1';
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.resetAllMocks());

  it('serves GET /settings, not a webhook called "settings"', async () => {
    service.getSettings.mockResolvedValue({
      defaultReaderRoleIds: [ROLE],
      defaultReaderRoles: [],
      source: 'environment',
      updatedAt: null,
      updatedBy: null,
    });

    const res = await request(app.getHttpServer())
      .get('/admin/inbound-webhooks/settings')
      .expect(200);

    expect(res.body.defaultReaderRoleIds).toEqual([ROLE]);
    expect(service.findById).not.toHaveBeenCalled();
  });

  it('replaces the default reader roles for the signed-in admin', async () => {
    service.updateSettings.mockResolvedValue({ defaultReaderRoleIds: [ROLE] });

    await request(app.getHttpServer())
      .put('/admin/inbound-webhooks/settings')
      .send({ defaultReaderRoleIds: [ROLE] })
      .expect(200);

    expect(service.updateSettings).toHaveBeenCalledWith([ROLE], 'admin-1');
  });

  it('accepts an empty list', async () => {
    service.updateSettings.mockResolvedValue({ defaultReaderRoleIds: [] });

    await request(app.getHttpServer())
      .put('/admin/inbound-webhooks/settings')
      .send({ defaultReaderRoleIds: [] })
      .expect(200);
  });

  it.each([
    [{}],
    [{ defaultReaderRoleIds: 'nope' }],
    [{ defaultReaderRoleIds: ['not-a-snowflake'] }],
    [{ defaultReaderRoleIds: [ROLE], extra: true }],
  ])('rejects an invalid body %j', async (body) => {
    await request(app.getHttpServer())
      .put('/admin/inbound-webhooks/settings')
      .send(body)
      .expect(400);
    expect(service.updateSettings).not.toHaveBeenCalled();
  });

  it('still routes a real webhook id to the webhook', async () => {
    service.findById.mockResolvedValue({ id: 'wh-1' });

    await request(app.getHttpServer())
      .get('/admin/inbound-webhooks/wh-1')
      .expect(200);

    expect(service.findById).toHaveBeenCalledWith('wh-1');
    expect(service.getSettings).not.toHaveBeenCalled();
  });
});
