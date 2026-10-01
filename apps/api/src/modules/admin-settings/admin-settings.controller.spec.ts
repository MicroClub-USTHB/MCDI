import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AdminSettingsController } from './admin-settings.controller';
import { SettingsService } from './settings.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

describe('AdminSettingsController (integration)', () => {
  let app: INestApplication;

  const effective = {
    discord: {
      clientId: { value: 'client-123', editable: false },
      token: { isSet: true, editable: false },
    },
    cache: { permissionTtlMs: { value: 300_000, editable: true } },
    rateLimit: { maxWebhooksPerProject: { value: 10, editable: true } },
    preferences: { memberActivityThresholdDays: { value: 30, editable: true } },
    security: {},
    meta: { updatedAt: null, updatedBy: null },
  };

  const mockService = {
    getEffectiveSettings: jest.fn().mockReturnValue(effective),
    updateSettings: jest.fn().mockResolvedValue(effective),
    resetSettings: jest.fn().mockResolvedValue(effective),
  };

  const guard = {
    canActivate: jest.fn((ctx: ExecutionContext) => {
      ctx.switchToHttp().getRequest().memberId = 'admin-1';
      return true;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminSettingsController],
      providers: [{ provide: SettingsService, useValue: mockService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue(guard)
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

  afterAll(async () => app.close());
  afterEach(() => jest.clearAllMocks());

  it('GET /admin/settings returns the effective settings', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/settings')
      .expect(200);
    expect(res.body.cache.permissionTtlMs).toEqual({
      value: 300_000,
      editable: true,
    });
    expect(res.body.discord.token).toEqual({ isSet: true, editable: false });
  });

  it('PATCH /admin/settings forwards the patch and the admin id', async () => {
    await request(app.getHttpServer())
      .patch('/admin/settings')
      .send({ cache: { permissionTtlMs: 600_000 } })
      .expect(200);
    expect(mockService.updateSettings).toHaveBeenCalledWith(
      { cache: { permissionTtlMs: 600_000 } },
      'admin-1',
    );
  });

  it('PATCH rejects an unknown / non-editable key', async () => {
    await request(app.getHttpServer())
      .patch('/admin/settings')
      .send({ discord: { token: 'new-secret' } })
      .expect(400);
    expect(mockService.updateSettings).not.toHaveBeenCalled();
  });

  it('PATCH rejects an out-of-range value', async () => {
    await request(app.getHttpServer())
      .patch('/admin/settings')
      .send({ rateLimit: { maxWebhooksPerProject: 0 } })
      .expect(400);
    expect(mockService.updateSettings).not.toHaveBeenCalled();
  });

  it('POST /admin/settings/reset clears overrides', async () => {
    await request(app.getHttpServer())
      .post('/admin/settings/reset')
      .expect(200);
    expect(mockService.resetSettings).toHaveBeenCalledWith('admin-1');
  });
});
