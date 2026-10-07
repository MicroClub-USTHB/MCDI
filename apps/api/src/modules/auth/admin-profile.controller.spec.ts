import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AdminProfileController } from './admin-profile.controller';
import { AdminProfileService } from './services/admin-profile.service';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';

const profile = {
  id: 'admin-1',
  username: 'johndoe',
  globalName: 'John Doe',
  displayName: 'John',
  preferredName: null,
  avatar: 'hash',
  email: 'john@example.com',
  isSystemAdmin: true,
};

describe('AdminProfileController (integration)', () => {
  let app: INestApplication;

  const mockService = {
    getProfile: jest.fn().mockResolvedValue(profile),
    updateProfile: jest.fn().mockResolvedValue(profile),
  };

  const guard = {
    canActivate: jest.fn((ctx: ExecutionContext) => {
      ctx.switchToHttp().getRequest().memberId = 'admin-1';
      return true;
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProfileController],
      providers: [{ provide: AdminProfileService, useValue: mockService }],
    })
      .overrideGuard(AdminAccessGuard)
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

  it('GET /admin/profile returns the profile for the session member', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/profile')
      .expect(200);
    expect(res.body.username).toBe('johndoe');
    expect(mockService.getProfile).toHaveBeenCalledWith('admin-1');
  });

  it('PATCH /admin/profile forwards preferredName and the member id', async () => {
    await request(app.getHttpServer())
      .patch('/admin/profile')
      .send({ preferredName: 'J. Doe' })
      .expect(200);
    expect(mockService.updateProfile).toHaveBeenCalledWith('admin-1', {
      preferredName: 'J. Doe',
    });
  });

  it('PATCH accepts an explicit null to clear', async () => {
    await request(app.getHttpServer())
      .patch('/admin/profile')
      .send({ preferredName: null })
      .expect(200);
    expect(mockService.updateProfile).toHaveBeenCalledWith('admin-1', {
      preferredName: null,
    });
  });

  it('PATCH rejects a Discord-owned field', async () => {
    await request(app.getHttpServer())
      .patch('/admin/profile')
      .send({ username: 'hacker' })
      .expect(400);
    expect(mockService.updateProfile).not.toHaveBeenCalled();
  });

  it('PATCH rejects an over-long name', async () => {
    await request(app.getHttpServer())
      .patch('/admin/profile')
      .send({ preferredName: 'x'.repeat(256) })
      .expect(400);
  });
});
