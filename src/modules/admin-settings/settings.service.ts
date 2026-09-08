import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { AppSettingsRow } from '../../database/entities';
import { SettingsRepository } from './settings.repository';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { EffectiveSettingsDto } from './dto/settings-response.dto';

/** Runtime-editable knobs. Each maps 1:1 to an `app_settings` column. */
export type SettingKey =
  | 'permissionCacheTtlMs'
  | 'statsCacheTtlMs'
  | 'memberActivityThresholdDays'
  | 'maxWebhooksPerProject';

export interface SettingChange {
  key: SettingKey;
  /** Effective value before the write. */
  from: number;
  /** Effective value after the write. */
  to: number;
}

export type SettingsChangeListener = (
  changes: SettingChange[],
) => void | Promise<void>;

const SETTING_KEYS: SettingKey[] = [
  'permissionCacheTtlMs',
  'statsCacheTtlMs',
  'memberActivityThresholdDays',
  'maxWebhooksPerProject',
];

// The row is mirrored to Redis on every write and re-read on this interval, so
// a PATCH on one instance propagates to the others within ~one tick. Postgres
// stays the source of truth; Redis is only the propagation channel.
const REDIS_SYNC_INTERVAL_MS = 20_000;
const REDIS_ROW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SettingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SettingsService.name);
  private readonly redisKey: string;
  private row: AppSettingsRow | null = null;
  private readonly listeners: SettingsChangeListener[] = [];
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly repo: SettingsRepository,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {
    const prefix = this.config.get<string>('redis.keyPrefix') || 'mcdi';
    this.redisKey = `${prefix}:app-settings:row`;
  }

  async onModuleInit(): Promise<void> {
    await this.load();
    // The daily-stats scheduler uses the same guard; timers add nothing in unit
    // tests and keep Jest from hanging on open handles.
    if (process.env.NODE_ENV !== 'test') {
      this.syncTimer = setInterval(() => {
        void this.syncFromRedis();
      }, REDIS_SYNC_INTERVAL_MS);
    }
  }

  onModuleDestroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /** Boot load: prefer the shared Redis copy, fall back to Postgres. */
  private async load(): Promise<void> {
    try {
      const cached = await this.redis.getJson<AppSettingsRow>(this.redisKey);
      if (cached) {
        this.row = this.reviveRow(cached);
        return;
      }
    } catch (err) {
      this.logger.warn(
        `Redis unavailable for app_settings, reading Postgres: ${(err as Error).message}`,
      );
    }

    try {
      this.row = await this.repo.find();
      await this.writeRedis();
    } catch (err) {
      // Never block boot on the settings row — fall back to env defaults.
      this.logger.warn(
        `Could not load app_settings, using env defaults: ${(err as Error).message}`,
      );
      this.row = null;
    }
  }

  /** Adopt a newer row written by another instance and notify local listeners. */
  private async syncFromRedis(): Promise<void> {
    let cached: AppSettingsRow | null;
    try {
      cached = await this.redis.getJson<AppSettingsRow>(this.redisKey);
    } catch {
      return; // transient Redis blip — keep the current row
    }
    if (!cached) return;

    const next = this.reviveRow(cached);
    if (this.snapshot(next) === this.snapshot(this.row)) return;

    const changes = this.diff(this.row, next);
    this.row = next;
    await this.notify(changes);
  }

  private async writeRedis(): Promise<void> {
    try {
      await this.redis.setJson(this.redisKey, this.row, REDIS_ROW_TTL_MS);
    } catch (err) {
      this.logger.warn(
        `Could not mirror app_settings to Redis: ${(err as Error).message}`,
      );
    }
  }

  private reviveRow(raw: AppSettingsRow): AppSettingsRow {
    return {
      ...raw,
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : raw.updatedAt,
    };
  }

  /** Stable string of the fields that affect effective values + `meta`. */
  private snapshot(row: AppSettingsRow | null): string {
    return JSON.stringify({
      knobs: SETTING_KEYS.map((k) => row?.[k] ?? null),
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt?.toISOString?.() ?? null,
    });
  }

  // ─── Effective values (override ?? env default) ──────────────────────────

  private envDefault(key: SettingKey): number {
    switch (key) {
      case 'permissionCacheTtlMs':
        return this.config.get<number>('app.permissionCacheTtlMs') ?? 300_000;
      case 'statsCacheTtlMs':
        return this.config.get<number>('app.statsCacheTtlMs') ?? 300_000;
      case 'memberActivityThresholdDays':
        return this.config.get<number>('app.memberActivityThresholdDays') ?? 30;
      case 'maxWebhooksPerProject':
        return this.config.get<number>('app.maxWebhooksPerProject') ?? 10;
    }
  }

  private effectiveOf(row: AppSettingsRow | null, key: SettingKey): number {
    const override = row?.[key];
    return typeof override === 'number' ? override : this.envDefault(key);
  }

  private effective(key: SettingKey): number {
    return this.effectiveOf(this.row, key);
  }

  private diff(
    from: AppSettingsRow | null,
    to: AppSettingsRow | null,
  ): SettingChange[] {
    return SETTING_KEYS.map((key) => ({
      key,
      from: this.effectiveOf(from, key),
      to: this.effectiveOf(to, key),
    })).filter((c) => c.from !== c.to);
  }

  getPermissionCacheTtlMs(): number {
    return this.effective('permissionCacheTtlMs');
  }

  getStatsCacheTtlMs(): number {
    return this.effective('statsCacheTtlMs');
  }

  getMemberActivityThresholdDays(): number {
    return this.effective('memberActivityThresholdDays');
  }

  getMaxWebhooksPerProject(): number {
    return this.effective('maxWebhooksPerProject');
  }

  // ─── Change notification ────────────────────────────────────────────────

  /**
   * Register a callback fired after a settings write (local or picked up from
   * another instance), with the before/after of every knob whose effective
   * value moved. Used by caches to flush stale-TTL'd entries. A registry
   * (rather than a direct dependency) keeps this module free of import cycles
   * with the feature modules that consume it.
   */
  registerChangeListener(listener: SettingsChangeListener): void {
    this.listeners.push(listener);
  }

  private async notify(changes: SettingChange[]): Promise<void> {
    if (changes.length === 0) return;
    for (const listener of this.listeners) {
      try {
        await listener(changes);
      } catch (err) {
        this.logger.warn(
          `Settings change listener failed: ${(err as Error).message}`,
        );
      }
    }
  }

  // ─── API surface ───────────────────────────────────────────────────────

  getEffectiveSettings(): EffectiveSettingsDto {
    const isSet = (v: string | undefined): boolean => !!v && v.length > 0;
    // THROTTLER_* are not in the Joi schema, so ConfigService hands them back
    // as raw strings — coerce so the response is uniformly numeric.
    const num = (key: string, fallback: number): number =>
      Number(this.config.get(key)) || fallback;
    return {
      discord: {
        clientId: {
          value: this.config.get<string>('discord.clientId') ?? '',
          editable: false,
        },
        guildId: {
          value: this.config.get<string>('discord.mainGuildId') ?? '',
          editable: false,
        },
        callbackUrl: {
          value: this.config.get<string>('discord.adminRedirectUri') ?? '',
          editable: false,
        },
        token: {
          isSet: isSet(this.config.get<string>('discord.token')),
          editable: false,
        },
        clientSecret: {
          isSet: isSet(this.config.get<string>('discord.clientSecret')),
          editable: false,
        },
      },
      cache: {
        permissionTtlMs: {
          value: this.getPermissionCacheTtlMs(),
          editable: true,
        },
        statsTtlMs: { value: this.getStatsCacheTtlMs(), editable: true },
        projectAuthTtlMs: {
          value: this.config.get<number>('app.projectAuthCacheTtlMs') ?? 30_000,
          editable: false,
        },
        projectAccessTtlMs: {
          value:
            this.config.get<number>('app.projectAccessCacheTtlMs') ?? 30_000,
          editable: false,
        },
      },
      rateLimit: {
        globalTtlMs: {
          value: num('THROTTLER_TTL_MS', 60_000),
          editable: false,
        },
        globalLimit: { value: num('THROTTLER_LIMIT', 120), editable: false },
        maxWebhooksPerProject: {
          value: this.getMaxWebhooksPerProject(),
          editable: true,
        },
      },
      preferences: {
        memberActivityThresholdDays: {
          value: this.getMemberActivityThresholdDays(),
          editable: true,
        },
      },
      security: {
        webhookEncryptionKey: {
          isSet: isSet(this.config.get<string>('app.webhookEncryptionKey')),
          editable: false,
        },
        sessionTtlSec: {
          value: this.config.get<number>('app.sessionTtlSec') ?? 2_592_000,
          editable: false,
        },
        ssoTtlSec: {
          value: this.config.get<number>('app.ssoTtlSec') ?? 2_592_000,
          editable: false,
        },
      },
      meta: {
        updatedAt: this.row?.updatedAt?.toISOString() ?? null,
        updatedBy: this.row?.updatedBy ?? null,
      },
    };
  }

  /** Apply a validated patch, persist, mirror to Redis, and notify listeners. */
  async updateSettings(
    dto: UpdateSettingsDto,
    updatedBy: string,
  ): Promise<EffectiveSettingsDto> {
    const columns: Partial<Record<SettingKey, number>> = {};
    const incoming: [number | undefined, SettingKey][] = [
      [dto.cache?.permissionTtlMs, 'permissionCacheTtlMs'],
      [dto.cache?.statsTtlMs, 'statsCacheTtlMs'],
      [dto.rateLimit?.maxWebhooksPerProject, 'maxWebhooksPerProject'],
      [
        dto.preferences?.memberActivityThresholdDays,
        'memberActivityThresholdDays',
      ],
    ];
    for (const [value, key] of incoming) {
      if (value !== undefined) columns[key] = value;
    }

    if (Object.keys(columns).length === 0) {
      return this.getEffectiveSettings();
    }

    const previous = this.row;
    this.row = await this.repo.upsert(columns, updatedBy);
    await this.writeRedis();
    await this.notify(this.diff(previous, this.row));

    return this.getEffectiveSettings();
  }

  /** Clear all overrides back to environment defaults. */
  async resetSettings(updatedBy: string): Promise<EffectiveSettingsDto> {
    const previous = this.row;
    this.row = await this.repo.reset(updatedBy);
    await this.writeRedis();
    await this.notify(this.diff(previous, this.row));

    return this.getEffectiveSettings();
  }
}
