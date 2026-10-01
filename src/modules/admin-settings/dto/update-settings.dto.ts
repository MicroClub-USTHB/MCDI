import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Bounds mirror the intent of the Joi env schema: positive integers, with
// upper caps that keep a typo from disabling a cache or the webhook limit.
const ONE_SECOND_MS = 1_000;
const ONE_DAY_MS = 86_400_000;

class UpdateCacheSettingsDto {
  @ApiPropertyOptional({ minimum: ONE_SECOND_MS, maximum: ONE_DAY_MS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(ONE_SECOND_MS)
  @Max(ONE_DAY_MS)
  permissionTtlMs?: number;

  @ApiPropertyOptional({ minimum: ONE_SECOND_MS, maximum: ONE_DAY_MS })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(ONE_SECOND_MS)
  @Max(ONE_DAY_MS)
  statsTtlMs?: number;
}

class UpdateRateLimitSettingsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  maxWebhooksPerProject?: number;
}

class UpdatePreferencesSettingsDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 3650 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  memberActivityThresholdDays?: number;
}

/**
 * Every field is optional; only the editable knobs are accepted. The global
 * `ValidationPipe` (`forbidNonWhitelisted: true`) rejects any other key,
 * including a read-only setting or a secret.
 */
export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: UpdateCacheSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCacheSettingsDto)
  cache?: UpdateCacheSettingsDto;

  @ApiPropertyOptional({ type: UpdateRateLimitSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRateLimitSettingsDto)
  rateLimit?: UpdateRateLimitSettingsDto;

  @ApiPropertyOptional({ type: UpdatePreferencesSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdatePreferencesSettingsDto)
  preferences?: UpdatePreferencesSettingsDto;
}
