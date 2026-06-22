import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

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
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('MCDI w l3alamiya');
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
