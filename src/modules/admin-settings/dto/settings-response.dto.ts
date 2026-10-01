import { ApiProperty } from '@nestjs/swagger';

/** A plain, editable-or-not scalar setting. */
class SettingValueDto {
  @ApiProperty({ description: 'Current effective value' })
  value!: string | number;

  @ApiProperty({ description: 'Whether PATCH /api/admin/settings accepts it' })
  editable!: boolean;
}

/** A secret: only whether it is configured is ever exposed. */
class SecretSettingDto {
  @ApiProperty({ description: 'Whether a non-empty value is configured' })
  isSet!: boolean;

  @ApiProperty({
    enum: [false],
    description: 'Secrets are never editable here',
  })
  editable!: false;
}

class DiscordSettingsDto {
  @ApiProperty({ type: SettingValueDto })
  clientId!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  guildId!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  callbackUrl!: SettingValueDto;

  @ApiProperty({ type: SecretSettingDto })
  token!: SecretSettingDto;

  @ApiProperty({ type: SecretSettingDto })
  clientSecret!: SecretSettingDto;
}

class CacheSettingsDto {
  @ApiProperty({ type: SettingValueDto })
  permissionTtlMs!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  statsTtlMs!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  projectAuthTtlMs!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  projectAccessTtlMs!: SettingValueDto;
}

class RateLimitSettingsDto {
  @ApiProperty({ type: SettingValueDto })
  globalTtlMs!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  globalLimit!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  maxWebhooksPerProject!: SettingValueDto;
}

class PreferencesSettingsDto {
  @ApiProperty({ type: SettingValueDto })
  memberActivityThresholdDays!: SettingValueDto;
}

class SecuritySettingsDto {
  @ApiProperty({ type: SecretSettingDto })
  webhookEncryptionKey!: SecretSettingDto;

  @ApiProperty({ type: SettingValueDto })
  sessionTtlSec!: SettingValueDto;

  @ApiProperty({ type: SettingValueDto })
  ssoTtlSec!: SettingValueDto;
}

class SettingsMetaDto {
  @ApiProperty({ nullable: true, description: 'When a knob was last written' })
  updatedAt!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Admin member id of last writer',
  })
  updatedBy!: string | null;
}

export class EffectiveSettingsDto {
  @ApiProperty({ type: DiscordSettingsDto })
  discord!: DiscordSettingsDto;

  @ApiProperty({ type: CacheSettingsDto })
  cache!: CacheSettingsDto;

  @ApiProperty({ type: RateLimitSettingsDto })
  rateLimit!: RateLimitSettingsDto;

  @ApiProperty({ type: PreferencesSettingsDto })
  preferences!: PreferencesSettingsDto;

  @ApiProperty({ type: SecuritySettingsDto })
  security!: SecuritySettingsDto;

  @ApiProperty({ type: SettingsMetaDto })
  meta!: SettingsMetaDto;
}
