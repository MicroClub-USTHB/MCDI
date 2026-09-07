import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

export type SettingsChangeListener = (
  changed: SettingKey[],
) => void | Promise<void>;

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private row: AppSettingsRow | null = null;
  private readonly listeners: SettingsChangeListener[] = [];

  constructor(
    private readonly repo: SettingsRepository,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.row = await this.repo.find();
    } catch (err) {
      // Never block boot on the settings row — fall back to env defaults.
      this.logger.warn(
        `Could not load app_settings, using env defaults: ${(err as Error).message}`,
      );
      this.row = null;
    }
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

  private effective(key: SettingKey): number {
    const override = this.row?.[key];
    return typeof override === 'number' ? override : this.envDefault(key);
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
   * Register a callback fired after a settings write, with the list of keys
   * whose effective value changed. Used by caches to flush stale-TTL'd entries.
   * A registry (rather than a direct dependency) keeps this module free of
   * import cycles with the feature modules that consume it.
   */
  registerChangeListener(listener: SettingsChangeListener): void {
    this.listeners.push(listener);
  }

  private async notify(changed: SettingKey[]): Promise<void> {
    if (changed.length === 0) return;
    for (const listener of this.listeners) {
      try {
        await listener(changed);
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
          value: this.config.get<number>('THROTTLER_TTL_MS') ?? 60_000,
          editable: false,
        },
        globalLimit: {
          value: this.config.get<number>('THROTTLER_LIMIT') ?? 120,
          editable: false,
        },
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

  /** Apply a validated patch, persist, reload, and notify listeners. */
  async updateSettings(
    dto: UpdateSettingsDto,
    updatedBy: string,
  ): Promise<EffectiveSettingsDto> {
    const columns: Record<string, number> = {};
    const map: [number | undefined, SettingKey][] = [
      [dto.cache?.permissionTtlMs, 'permissionCacheTtlMs'],
      [dto.cache?.statsTtlMs, 'statsCacheTtlMs'],
      [dto.rateLimit?.maxWebhooksPerProject, 'maxWebhooksPerProject'],
      [
        dto.preferences?.memberActivityThresholdDays,
        'memberActivityThresholdDays',
      ],
    ];

    const before = new Map<SettingKey, number>();
    for (const [incoming, key] of map) {
      before.set(key, this.effective(key));
      if (incoming !== undefined) columns[key] = incoming;
    }

    if (Object.keys(columns).length > 0) {
      this.row = await this.repo.upsert(columns, updatedBy);
    }

    const changed = [...before.keys()].filter(
      (key) => this.effective(key) !== before.get(key),
    );
    await this.notify(changed);

    return this.getEffectiveSettings();
  }

  /** Clear all overrides back to environment defaults. */
  async resetSettings(updatedBy: string): Promise<EffectiveSettingsDto> {
    const before: Record<SettingKey, number> = {
      permissionCacheTtlMs: this.effective('permissionCacheTtlMs'),
      statsCacheTtlMs: this.effective('statsCacheTtlMs'),
      memberActivityThresholdDays: this.effective(
        'memberActivityThresholdDays',
      ),
      maxWebhooksPerProject: this.effective('maxWebhooksPerProject'),
    };
    this.row = await this.repo.reset(updatedBy);

    const changed = (Object.keys(before) as SettingKey[]).filter(
      (key) => this.effective(key) !== before[key],
    );
    await this.notify(changed);

    return this.getEffectiveSettings();
  }
}
