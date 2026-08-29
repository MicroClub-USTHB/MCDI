import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhooksService } from './webhooks.service';
import { WebhooksRepository } from './webhooks.repository';
import { DiscordService } from '../discord/discord.service';
import {
  decryptSecret,
  encryptSecret,
} from '../../common/utils/encryption.util';

const KEY = 'a'.repeat(64);
const WEBHOOK_ID = '11111111-1111-4111-8111-111111111111';

const row = {
  id: WEBHOOK_ID,
  discordWebhookId: 'dw-1',
  projectId: 'proj-1',
  serverId: 'srv-1',
  channelId: 'ch-1',
  name: 'hook',
  avatar: null,
  encryptedToken: 'enc',
  usageCount: 0,
  lastUsedAt: null,
  createdAt: new Date('2025-01-15T14:30:00Z'),
  updatedAt: new Date('2025-01-15T14:30:00Z'),
};

describe('WebhooksService', () => {
  let service: WebhooksService;

  const mockDiscordService = {
    getChannelById: jest.fn().mockResolvedValue({
      isDMBased: () => false,
      isThread: () => false,
      type: 0,
    }),
    createWebhook: jest.fn(),
    executeWebhook: jest.fn(),
    editWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
    getCachedChannelName: jest.fn().mockReturnValue(null),
    getCachedGuildName: jest.fn().mockReturnValue(null),
  };

  const mockRepository = {
    create: jest.fn(),
    countByProject: jest.fn(),
    findById: jest.fn(),
    findByProject: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    recordExecution: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'app.webhookEncryptionKey') return KEY;
      if (key === 'app.maxWebhooksPerProject') return 10;
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: DiscordService, useValue: mockDiscordService },
        { provide: WebhooksRepository, useValue: mockRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(WebhooksService);
    mockRepository.countByProject.mockResolvedValue(0);
    mockRepository.recordExecution.mockResolvedValue(true);
    mockDiscordService.executeWebhook.mockResolvedValue(undefined);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createWebhook', () => {
    it('stores the Discord token encrypted and never returns it', async () => {
      mockDiscordService.createWebhook.mockResolvedValue({
        id: 'dw-1',
        name: 'hook',
        avatar: null,
        token: 'secret-token',
      });
      mockRepository.create.mockImplementation((data) =>
        Promise.resolve({ ...row, ...data }),
      );

      const result = await service.createWebhook('srv-1', 'ch-1', 'proj-1', {
        name: 'hook',
      });

      const stored = mockRepository.create.mock.calls[0][0];
      expect(stored.encryptedToken).not.toContain('secret-token');
      expect(decryptSecret(stored.encryptedToken, KEY)).toBe('secret-token');
      expect(JSON.stringify(result)).not.toContain('secret-token');
      expect(result.usageCount).toBe(0);
    });

    it('rejects an avatar that decodes to more than 256KB', async () => {
      const oversized = Buffer.alloc(256 * 1024 + 1).toString('base64');

      await expect(
        service.createWebhook('srv-1', 'ch-1', 'proj-1', {
          name: 'hook',
          avatar: oversized,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockDiscordService.createWebhook).not.toHaveBeenCalled();
    });

    it('rejects an avatar that is not base64', async () => {
      await expect(
        service.createWebhook('srv-1', 'ch-1', 'proj-1', {
          name: 'hook',
          avatar: 'not base64!!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 502 when Discord cannot create the webhook', async () => {
      mockDiscordService.createWebhook.mockResolvedValue(null);

      await expect(
        service.createWebhook('srv-1', 'ch-1', 'proj-1', { name: 'hook' }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('rejects creation at the project limit before calling Discord', async () => {
      mockRepository.countByProject.mockResolvedValue(10);

      await expect(
        service.createWebhook('srv-1', 'ch-1', 'proj-1', { name: 'hook' }),
      ).rejects.toThrow(ConflictException);

      expect(mockDiscordService.getChannelById).not.toHaveBeenCalled();
      expect(mockDiscordService.createWebhook).not.toHaveBeenCalled();
    });

    it('rejects a thread before calling Discord', async () => {
      mockDiscordService.getChannelById.mockResolvedValueOnce({
        isDMBased: () => false,
        isThread: () => true,
        type: 11,
      });

      await expect(
        service.createWebhook('srv-1', 'ch-1', 'proj-1', { name: 'hook' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockDiscordService.createWebhook).not.toHaveBeenCalled();
    });
  });

  describe('ownership', () => {
    it('returns 404 when the webhook belongs to another project', async () => {
      mockRepository.findById.mockResolvedValue({
        ...row,
        projectId: 'other-project',
      });

      await expect(service.getWebhook(WEBHOOK_ID, 'proj-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 for a non-uuid webhook id without querying', async () => {
      await expect(service.getWebhook('not-a-uuid', 'proj-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('returns 404 when listing another project id', async () => {
      await expect(
        service.listWebhooks('proj-1', 'other-project', {}),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepository.findByProject).not.toHaveBeenCalled();
    });
  });

  describe('deleteWebhook', () => {
    it('deletes the row when Discord reports the webhook gone', async () => {
      // DiscordService.deleteWebhook already treats Unknown Webhook (10015)
      // as deleted, so the row cleanup must proceed on true
      mockRepository.findById.mockResolvedValue(row);
      mockDiscordService.deleteWebhook.mockResolvedValue(true);

      await service.deleteWebhook(WEBHOOK_ID, 'proj-1');

      expect(mockDiscordService.deleteWebhook).toHaveBeenCalledWith('dw-1');
      expect(mockRepository.delete).toHaveBeenCalledWith(WEBHOOK_ID);
    });

    it('keeps the row when the Discord delete fails', async () => {
      mockRepository.findById.mockResolvedValue(row);
      mockDiscordService.deleteWebhook.mockResolvedValue(false);

      await expect(service.deleteWebhook(WEBHOOK_ID, 'proj-1')).rejects.toThrow(
        BadGatewayException,
      );
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('executeWebhook', () => {
    const executableRow = {
      ...row,
      encryptedToken: encryptSecret('secret-token', KEY),
    };

    it('decrypts the token, sends the payload and records one execution', async () => {
      mockRepository.findById.mockResolvedValue(executableRow);

      await service.executeWebhook(WEBHOOK_ID, 'proj-1', {
        content: 'Deployment completed',
        embeds: [{ title: 'Status' }],
        username: 'Deployments',
        avatar_url: 'https://example.com/avatar.png',
      });

      expect(mockDiscordService.executeWebhook).toHaveBeenCalledWith(
        'dw-1',
        'secret-token',
        {
          content: 'Deployment completed',
          embeds: [{ title: 'Status' }],
          username: 'Deployments',
          avatarURL: 'https://example.com/avatar.png',
        },
      );
      expect(mockRepository.recordExecution).toHaveBeenCalledWith(WEBHOOK_ID);
    });

    it('rejects an empty message before decrypting or sending', async () => {
      mockRepository.findById.mockResolvedValue(executableRow);

      await expect(
        service.executeWebhook(WEBHOOK_ID, 'proj-1', {}),
      ).rejects.toThrow(BadRequestException);

      expect(mockDiscordService.executeWebhook).not.toHaveBeenCalled();
      expect(mockRepository.recordExecution).not.toHaveBeenCalled();
    });

    it('checks ownership before decrypting or sending', async () => {
      mockRepository.findById.mockResolvedValue({
        ...executableRow,
        projectId: 'other-project',
        encryptedToken: 'invalid',
      });

      await expect(
        service.executeWebhook(WEBHOOK_ID, 'proj-1', { content: 'hello' }),
      ).rejects.toThrow(NotFoundException);

      expect(mockDiscordService.executeWebhook).not.toHaveBeenCalled();
      expect(mockRepository.recordExecution).not.toHaveBeenCalled();
    });

    it('rejects aggregate embed text over 6000 characters before decrypting', async () => {
      mockRepository.findById.mockResolvedValue({
        ...executableRow,
        encryptedToken: 'invalid',
      });

      await expect(
        service.executeWebhook(WEBHOOK_ID, 'proj-1', {
          embeds: [
            {
              title: 't'.repeat(256),
              description: 'd'.repeat(4096),
              footer: { text: 'f'.repeat(1000) },
              author: { name: 'a'.repeat(256) },
            },
            {
              title: 't'.repeat(256),
              description: 'd'.repeat(137),
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockDiscordService.executeWebhook).not.toHaveBeenCalled();
      expect(mockRepository.recordExecution).not.toHaveBeenCalled();
    });

    it('succeeds on the third Discord attempt', async () => {
      jest.useFakeTimers();
      try {
        mockRepository.findById.mockResolvedValue(executableRow);
        mockDiscordService.executeWebhook
          .mockRejectedValueOnce(new Error('first failure'))
          .mockRejectedValueOnce(new Error('second failure'))
          .mockResolvedValueOnce(undefined);

        const execution = service.executeWebhook(WEBHOOK_ID, 'proj-1', {
          content: 'hello',
        });
        await jest.advanceTimersByTimeAsync(3000);
        await execution;

        expect(mockDiscordService.executeWebhook).toHaveBeenCalledTimes(3);
        expect(mockRepository.recordExecution).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns 502 without tracking after three failed attempts', async () => {
      jest.useFakeTimers();
      try {
        mockRepository.findById.mockResolvedValue(executableRow);
        mockDiscordService.executeWebhook.mockRejectedValue(
          new Error('request failed for secret-token'),
        );
        const warn = jest.spyOn((service as any).logger, 'warn');

        const rejection = expect(
          service.executeWebhook(WEBHOOK_ID, 'proj-1', { content: 'hello' }),
        ).rejects.toThrow(BadGatewayException);
        await jest.advanceTimersByTimeAsync(3000);
        await rejection;

        expect(mockDiscordService.executeWebhook).toHaveBeenCalledTimes(3);
        expect(mockRepository.recordExecution).not.toHaveBeenCalled();
        expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token');
      } finally {
        jest.useRealTimers();
      }
    });

    it('returns success when execution tracking rejects after the send', async () => {
      mockRepository.findById.mockResolvedValue(executableRow);
      mockRepository.recordExecution.mockRejectedValueOnce(
        new Error('tracking failed for secret-token'),
      );
      const warn = jest.spyOn((service as any).logger, 'warn');

      await expect(
        service.executeWebhook(WEBHOOK_ID, 'proj-1', { content: 'hello' }),
      ).resolves.toBeUndefined();

      expect(mockDiscordService.executeWebhook).toHaveBeenCalledTimes(1);
      expect(mockRepository.recordExecution).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token');
    });

    it('returns success when execution tracking reports no updated row', async () => {
      mockRepository.findById.mockResolvedValue(executableRow);
      mockRepository.recordExecution.mockResolvedValueOnce(false);
      const warn = jest.spyOn((service as any).logger, 'warn');

      await expect(
        service.executeWebhook(WEBHOOK_ID, 'proj-1', { content: 'hello' }),
      ).resolves.toBeUndefined();

      expect(mockDiscordService.executeWebhook).toHaveBeenCalledTimes(1);
      expect(mockRepository.recordExecution).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(warn.mock.calls)).not.toContain('secret-token');
    });
  });

  describe('updateWebhook', () => {
    it('rejects an oversized avatar before calling Discord', async () => {
      mockRepository.findById.mockResolvedValue(row);
      const oversized = Buffer.alloc(256 * 1024 + 1).toString('base64');

      await expect(
        service.updateWebhook(WEBHOOK_ID, 'proj-1', { avatar: oversized }),
      ).rejects.toThrow(BadRequestException);
      expect(mockDiscordService.editWebhook).not.toHaveBeenCalled();
    });

    it('passes null through to remove the avatar', async () => {
      mockRepository.findById.mockResolvedValue(row);
      mockDiscordService.editWebhook.mockResolvedValue({
        id: 'dw-1',
        name: 'hook',
        avatar: null,
      });
      mockRepository.update.mockResolvedValue(row);

      await service.updateWebhook(WEBHOOK_ID, 'proj-1', { avatar: null });

      expect(mockDiscordService.editWebhook).toHaveBeenCalledWith('dw-1', {
        avatar: null,
      });
    });
  });
});
