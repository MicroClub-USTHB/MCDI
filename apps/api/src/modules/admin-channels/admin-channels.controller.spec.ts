import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AdminChannelsController } from './admin-channels.controller';
import { ChannelsService } from '../channels/channels.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

describe('AdminChannelsController (integration)', () => {
  let app: INestApplication;

  const mockService = {
    listChannels: jest.fn(),
    getChannel: jest.fn(),
    getMessages: jest.fn(),
  };

  const allow = { canActivate: jest.fn().mockResolvedValue(true) };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminChannelsController],
      providers: [{ provide: ChannelsService, useValue: mockService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue(allow)
      .overrideGuard(ThrottlerGuard)
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

  describe('GET /admin/servers/:serverId/channels', () => {
    it('returns 200 and delegates to ChannelsService.listChannels', async () => {
      mockService.listChannels.mockResolvedValue({
        channels: [{ id: 'ch-1', name: 'general' }],
        categories: [],
      });

      const res = await request(app.getHttpServer())
        .get('/admin/servers/123/channels?type=text')
        .expect(200);

      expect(res.body.channels).toHaveLength(1);
      expect(mockService.listChannels).toHaveBeenCalledWith('123', {
        type: 'text',
      });
    });
  });

  describe('GET /admin/servers/:serverId/channels/:channelId', () => {
    it('returns 200 with channel detail including permission overwrites', async () => {
      mockService.getChannel.mockResolvedValue({
        id: 'ch-1',
        name: 'general',
        type: 'text',
        permissionOverwrites: true,
        overwrites: [{ id: 'role-1', type: 'role', allow: '1024', deny: '0' }],
      });

      const res = await request(app.getHttpServer())
        .get('/admin/servers/123/channels/ch-1')
        .expect(200);

      expect(res.body.id).toBe('ch-1');
      expect(res.body.overwrites[0].type).toBe('role');
      expect(mockService.getChannel).toHaveBeenCalledWith('123', 'ch-1');
    });

    it('propagates a service NotFoundException as {statusCode, code, message}', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockService.getChannel.mockRejectedValue(
        new NotFoundException({
          code: 'CHANNEL_NOT_FOUND',
          message: 'Channel does not exist or bot lacks access',
        }),
      );

      const res = await request(app.getHttpServer())
        .get('/admin/servers/123/channels/nope')
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        code: 'CHANNEL_NOT_FOUND',
      });
    });
  });

  describe('GET /admin/servers/:serverId/channels/:channelId/messages', () => {
    it('returns 200 and forwards the parsed query (default limit 50)', async () => {
      mockService.getMessages.mockResolvedValue({
        messages: [],
        hasMore: false,
      });

      const res = await request(app.getHttpServer())
        .get('/admin/servers/123/channels/ch-1/messages')
        .expect(200);

      expect(res.body.hasMore).toBe(false);
      expect(mockService.getMessages).toHaveBeenCalledWith('123', 'ch-1', {
        limit: 50,
      });
    });

    it('rejects an out-of-range limit with 400', async () => {
      await request(app.getHttpServer())
        .get('/admin/servers/123/channels/ch-1/messages?limit=500')
        .expect(400);
    });
  });
});
