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
    previewSchema: jest.fn(),
    rotateSecret: jest.fn(),
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

  describe('POST /schema/preview', () => {
    const schema = { version: 1, steps: [] };

    it('previews a schema and answers 200, since nothing is created', async () => {
      service.previewSchema.mockResolvedValue({ ok: false, errors: [] });

      const res = await request(app.getHttpServer())
        .post('/admin/inbound-webhooks/schema/preview')
        .send({ schema, name: 'Recruitment' })
        .expect(200);

      expect(res.body).toEqual({ ok: false, errors: [] });
      expect(service.previewSchema).toHaveBeenCalledWith({
        schema,
        name: 'Recruitment',
      });
    });

    it('passes the options the docs depend on', async () => {
      service.previewSchema.mockResolvedValue({ ok: true });

      await request(app.getHttpServer())
        .post('/admin/inbound-webhooks/schema/preview')
        .send({
          schema,
          requireSignature: false,
          rejectUnknownFields: false,
          acceptedOrigins: ['https://app.microclub.dz'],
        })
        .expect(200);

      expect(service.previewSchema).toHaveBeenCalledWith({
        schema,
        requireSignature: false,
        rejectUnknownFields: false,
        acceptedOrigins: ['https://app.microclub.dz'],
      });
    });

    it.each([
      [{}],
      [{ schema: 'nope' }],
      [{ schema: [] }],
      [{ schema, name: 5 }],
      [{ schema, requireSignature: 'yes' }],
      [{ schema, extra: true }],
    ])('rejects a malformed request %j with 400', async (body) => {
      await request(app.getHttpServer())
        .post('/admin/inbound-webhooks/schema/preview')
        .send(body)
        .expect(400);
      expect(service.previewSchema).not.toHaveBeenCalled();
    });

    it('is not mistaken for another webhook route', async () => {
      service.previewSchema.mockResolvedValue({ ok: false, errors: [] });

      await request(app.getHttpServer())
        .post('/admin/inbound-webhooks/schema/preview')
        .send({ schema })
        .expect(200);

      expect(service.rotateSecret).not.toHaveBeenCalled();
    });
  });
});
