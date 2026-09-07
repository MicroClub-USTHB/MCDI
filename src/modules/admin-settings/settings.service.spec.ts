import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppSettingsRow } from '../../database/entities';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';

const ENV_DEFAULTS: Record<string, number | string> = {
  'app.permissionCacheTtlMs': 300_000,
  'app.statsCacheTtlMs': 300_000,
  'app.memberActivityThresholdDays': 30,
  'app.maxWebhooksPerProject': 10,
  'app.projectAuthCacheTtlMs': 30_000,
  'app.projectAccessCacheTtlMs': 30_000,
  'app.sessionTtlSec': 2_592_000,
  'app.ssoTtlSec': 2_592_000,
  'app.webhookEncryptionKey': 'a'.repeat(64),
  'discord.clientId': 'client-123',
  'discord.mainGuildId': 'guild-123',
  'discord.adminRedirectUri': 'https://mcdi.test/callback',
  'discord.token': 'bot-token',
  'discord.clientSecret': '',
  THROTTLER_TTL_MS: 60_000,
  THROTTLER_LIMIT: 120,
};

const row = (over: Partial<AppSettingsRow> = {}): AppSettingsRow => ({
  id: 1,
  permissionCacheTtlMs: null,
  statsCacheTtlMs: null,
  memberActivityThresholdDays: null,
  maxWebhooksPerProject: null,
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedBy: null,
  ...over,
});

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: jest.Mocked<SettingsRepository>;

  beforeEach(async () => {
    const mockRepo: Partial<jest.Mocked<SettingsRepository>> = {
      find: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      reset: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: mockRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => ENV_DEFAULTS[k]) },
        },
      ],
    }).compile();
    service = module.get(SettingsService);
    repo = module.get(SettingsRepository);
    await service.onModuleInit();
  });

  it('falls back to env defaults when no row is stored', () => {
    expect(service.getPermissionCacheTtlMs()).toBe(300_000);
    expect(service.getMaxWebhooksPerProject()).toBe(10);
  });

  it('boots with env defaults if the row load throws', async () => {
    repo.find.mockRejectedValueOnce(new Error('db down'));
    await service.onModuleInit();
    expect(service.getStatsCacheTtlMs()).toBe(300_000);
  });

  it('prefers a stored override over the env default', async () => {
    repo.find.mockResolvedValueOnce(row({ permissionCacheTtlMs: 600_000 }));
    await service.onModuleInit();
    expect(service.getPermissionCacheTtlMs()).toBe(600_000);
    expect(service.getStatsCacheTtlMs()).toBe(300_000); // still default
  });

  describe('getEffectiveSettings', () => {
    it('marks the four knobs editable and everything else read-only', () => {
      const s = service.getEffectiveSettings();
      expect(s.cache.permissionTtlMs).toEqual({
        value: 300_000,
        editable: true,
      });
      expect(s.rateLimit.maxWebhooksPerProject.editable).toBe(true);
      expect(s.preferences.memberActivityThresholdDays.editable).toBe(true);
      expect(s.cache.projectAuthTtlMs.editable).toBe(false);
      expect(s.rateLimit.globalLimit).toEqual({ value: 120, editable: false });
    });

    it('exposes secrets only as isSet, never the value', () => {
      const s = service.getEffectiveSettings();
      expect(s.discord.token).toEqual({ isSet: true, editable: false });
      expect(s.discord.clientSecret).toEqual({ isSet: false, editable: false });
      expect(s.security.webhookEncryptionKey.isSet).toBe(true);
      expect(JSON.stringify(s)).not.toContain('bot-token');
    });
  });

  describe('updateSettings', () => {
    it('persists only the provided knobs and notifies changed keys', async () => {
      repo.upsert.mockResolvedValue(row({ permissionCacheTtlMs: 600_000 }));
      const listener = jest.fn();
      service.registerChangeListener(listener);

      await service.updateSettings(
        { cache: { permissionTtlMs: 600_000 } },
        'admin-1',
      );

      expect(repo.upsert).toHaveBeenCalledWith(
        { permissionCacheTtlMs: 600_000 },
        'admin-1',
      );
      expect(listener).toHaveBeenCalledWith(['permissionCacheTtlMs']);
    });

    it('does not touch the DB or notify when nothing changes', async () => {
      const listener = jest.fn();
      service.registerChangeListener(listener);

      await service.updateSettings({}, 'admin-1');

      expect(repo.upsert).not.toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });

    it('does not notify when the patched value equals the current one', async () => {
      repo.upsert.mockResolvedValue(row({ maxWebhooksPerProject: 10 }));
      const listener = jest.fn();
      service.registerChangeListener(listener);

      await service.updateSettings(
        { rateLimit: { maxWebhooksPerProject: 10 } },
        'admin-1',
      );

      expect(repo.upsert).toHaveBeenCalled();
      expect(listener).not.toHaveBeenCalled();
    });

    it('survives a throwing listener', async () => {
      repo.upsert.mockResolvedValue(row({ statsCacheTtlMs: 120_000 }));
      service.registerChangeListener(() => {
        throw new Error('boom');
      });
      await expect(
        service.updateSettings({ cache: { statsTtlMs: 120_000 } }, 'admin-1'),
      ).resolves.toBeDefined();
    });
  });

  describe('resetSettings', () => {
    it('clears overrides and notifies the keys that reverted', async () => {
      repo.find.mockResolvedValueOnce(
        row({ permissionCacheTtlMs: 600_000, maxWebhooksPerProject: 25 }),
      );
      await service.onModuleInit();
      repo.reset.mockResolvedValue(row());
      const listener = jest.fn();
      service.registerChangeListener(listener);

      await service.resetSettings('admin-1');

      expect(repo.reset).toHaveBeenCalledWith('admin-1');
      expect(service.getPermissionCacheTtlMs()).toBe(300_000);
      const changed = listener.mock.calls[0][0] as string[];
      expect(changed.sort()).toEqual(
        ['maxWebhooksPerProject', 'permissionCacheTtlMs'].sort(),
      );
    });
  });
});
