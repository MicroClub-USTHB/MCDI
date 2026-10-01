import type { AdminProfile } from '@mcdi/contracts';

export interface SettingValue<T = number> {
  value: T;
  editable: boolean;
}

export interface SecretSetting {
  isSet: boolean;
  editable: false;
}

export interface DiscordSettings {
  clientId: SettingValue<string>;
  guildId: SettingValue<string>;
  callbackUrl: SettingValue<string>;
  token: SecretSetting;
  clientSecret: SecretSetting;
}

export interface CacheSettingsGroup {
  permissionTtlMs: SettingValue;
  statsTtlMs: SettingValue;
  projectAuthTtlMs: SettingValue;
  projectAccessTtlMs: SettingValue;
}

export interface RateLimitSettingsGroup {
  globalTtlMs: SettingValue;
  globalLimit: SettingValue;
  maxWebhooksPerProject: SettingValue;
}

export interface PreferencesSettingsGroup {
  memberActivityThresholdDays: SettingValue;
}

export interface SecuritySettingsGroup {
  webhookEncryptionKey: SecretSetting;
  sessionTtlSec: SettingValue;
  ssoTtlSec: SettingValue;
}

export interface SettingsMeta {
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface SettingsDto {
  discord: DiscordSettings;
  cache: CacheSettingsGroup;
  rateLimit: RateLimitSettingsGroup;
  preferences: PreferencesSettingsGroup;
  security: SecuritySettingsGroup;
  meta: SettingsMeta;
}

export interface UpdateSettingsPayload {
  cache?: {
    permissionTtlMs?: number;
    statsTtlMs?: number;
  };
  rateLimit?: {
    maxWebhooksPerProject?: number;
  };
  preferences?: {
    memberActivityThresholdDays?: number;
  };
}

export type AdminProfileDto = AdminProfile;

export interface UpdateProfilePayload {
  preferredName?: string | null;
}
