import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { DRIZZLE } from './database/database.module';
import { RedisService } from './common/redis/redis.service';

describe('AppController', () => {
  let appController: AppController;

  const dbMock = { execute: jest.fn().mockResolvedValue(undefined) };
  const redisMock = { ping: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'app.apiPrefix') return 'api';
              return undefined;
            }),
          },
        },
        { provide: DRIZZLE, useValue: dbMock },
        { provide: RedisService, useValue: redisMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('MCDI w l3alamiya');
    });
  });

  describe('health', () => {
    it('returns ok with both dependencies up', async () => {
      dbMock.execute.mockResolvedValueOnce(undefined);
      redisMock.ping.mockResolvedValueOnce(true);

      const result = await appController.getHealth();

      expect(result).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
        database: 'up',
        redis: 'up',
      });
      expect(Number.isFinite(result.uptime)).toBe(true);
    });

    it('reports degraded when the database is unreachable', async () => {
      dbMock.execute.mockRejectedValueOnce(new Error('db down'));
      redisMock.ping.mockResolvedValueOnce(true);

      const result = await appController.getHealth();

      expect(result).toMatchObject({ status: 'degraded', database: 'down' });
    });

    it('reports degraded when redis is unreachable', async () => {
      dbMock.execute.mockResolvedValueOnce(undefined);
      redisMock.ping.mockResolvedValueOnce(false);

      const result = await appController.getHealth();

      expect(result).toMatchObject({ status: 'degraded', redis: 'down' });
    });
  });

  describe('admin', () => {
    it('renders the admin landing page with the expected endpoints', () => {
      const render = jest.fn();
      const req = { headers: {}, cookies: { admin_session: 'test-token' } };

      appController.renderAdmin(req as any, { render } as any);

      expect(render).toHaveBeenCalledWith(
        'admin',
        expect.objectContaining({
          hasSessionToken: true,
          loginUrl: '/api/auth/admin/discord',
          adminMeUrl: '/api/auth/admin/me',
          createProjectUrl: '/api/admin/projects',
        }),
      );
    });

    it('redirects to the admin auth initiation endpoint', () => {
      const redirect = jest.fn();

      appController.adminLogin({ redirect } as any);

      expect(redirect).toHaveBeenCalledWith('/api/auth/admin/discord');
    });
  });
});
