import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { AppSettingsRow } from '../../database/entities';
import { SettingChange, SettingsService } from './settings.service';
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
  'redis.keyPrefix': 'mcdi',
  'discord.clientId': 'client-123',
  'discord.mainGuildId': 'guild-123',
  'discord.adminRedirectUri': 'https://mcdi.test/callback',
  'discord.token': 'bot-token',
  'discord.clientSecret': '',
  // Not in the Joi schema — ConfigService returns the raw string.
  THROTTLER_TTL_MS: '60000',
  THROTTLER_LIMIT: '120',
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
  let redis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
  };

  beforeEach(async () => {
    const mockRepo: Partial<jest.Mocked<SettingsRepository>> = {
      find: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      reset: jest.fn(),
    };
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsRepository, useValue: mockRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((k: string) => ENV_DEFAULTS[k]) },
        },
        { provide: RedisService, useValue: redis },
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

  it('prefers the shared Redis copy over Postgres on boot', async () => {
    repo.find.mockClear();
    redis.getJson.mockResolvedValueOnce(row({ permissionCacheTtlMs: 900_000 }));
    await service.onModuleInit();
    expect(service.getPermissionCacheTtlMs()).toBe(900_000);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('falls back to Postgres and seeds Redis when the cache is empty', async () => {
    repo.find.mockResolvedValueOnce(row({ statsCacheTtlMs: 111_000 }));
    await service.onModuleInit();
    expect(service.getStatsCacheTtlMs()).toBe(111_000);
    expect(redis.setJson).toHaveBeenCalledWith(
      'mcdi:app-settings:row',
      expect.objectContaining({ statsCacheTtlMs: 111_000 }),
      expect.any(Number),
    );
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
    });

    it('coerces the raw THROTTLER_* env strings to numbers', () => {
      const s = service.getEffectiveSettings();
      expect(s.rateLimit.globalTtlMs).toEqual({
        value: 60_000,
        editable: false,
      });
      expect(s.rateLimit.globalLimit).toEqual({ value: 120, editable: false });
      expect(typeof s.rateLimit.globalTtlMs.value).toBe('number');
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
    it('persists the knobs, mirrors to Redis, and notifies before→after', async () => {
      repo.upsert.mockResolvedValue(row({ permissionCacheTtlMs: 600_000 }));
      const changes: SettingChange[][] = [];
      service.registerChangeListener((c) => void changes.push(c));

      await service.updateSettings(
        { cache: { permissionTtlMs: 600_000 } },
        'admin-1',
      );

      expect(repo.upsert).toHaveBeenCalledWith(
        { permissionCacheTtlMs: 600_000 },
        'admin-1',
      );
      expect(redis.setJson).toHaveBeenLastCalledWith(
        'mcdi:app-settings:row',
        expect.objectContaining({ permissionCacheTtlMs: 600_000 }),
        expect.any(Number),
      );
      expect(changes).toEqual([
        [{ key: 'permissionCacheTtlMs', from: 300_000, to: 600_000 }],
      ]);
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
      redis.getJson.mockResolvedValueOnce(
        row({ permissionCacheTtlMs: 600_000, maxWebhooksPerProject: 25 }),
      );
      await service.onModuleInit();
      repo.reset.mockResolvedValue(row());
      const changes: SettingChange[][] = [];
      service.registerChangeListener((c) => void changes.push(c));

      await service.resetSettings('admin-1');

      expect(repo.reset).toHaveBeenCalledWith('admin-1');
      expect(service.getPermissionCacheTtlMs()).toBe(300_000);
      const keys = changes[0].map((c) => c.key).sort();
      expect(keys).toEqual(['maxWebhooksPerProject', 'permissionCacheTtlMs']);
    });
  });
});
