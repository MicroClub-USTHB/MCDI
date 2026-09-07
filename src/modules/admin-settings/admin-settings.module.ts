import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';

/**
 * Runtime-editable operational settings. `SettingsService` is the single reader
 * of the editable knobs — feature modules import this module and pull effective
 * values from it instead of `ConfigService`, so a `PATCH /api/admin/settings`
 * takes effect without a restart.
 */
@Module({
  providers: [SettingsService, SettingsRepository],
  exports: [SettingsService],
})
export class AdminSettingsModule {}
