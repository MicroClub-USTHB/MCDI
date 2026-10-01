import type { AdminProfileDto, SettingsDto } from '@/features/settings/types';

export function mapSettingsResponse(dto: SettingsDto): SettingsDto {
  return dto;
}

export function mapProfileResponse(dto: AdminProfileDto): AdminProfileDto {
  return dto;
}
