import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  AdminProfileDto,
  SettingsDto,
  UpdateProfilePayload,
  UpdateSettingsPayload,
} from '@/features/settings/types';

export function getSettings(): Promise<ApiResponse<SettingsDto>> {
  return apiClient.get<SettingsDto>('/admin/settings');
}

export function updateSettings(payload: UpdateSettingsPayload): Promise<ApiResponse<SettingsDto>> {
  return apiClient.patch<SettingsDto>('/admin/settings', payload);
}

export function resetSettings(): Promise<ApiResponse<SettingsDto>> {
  return apiClient.post<SettingsDto>('/admin/settings/reset');
}

export function getProfile(): Promise<ApiResponse<AdminProfileDto>> {
  return apiClient.get<AdminProfileDto>('/admin/profile');
}

export function updateProfile(
  payload: UpdateProfilePayload
): Promise<ApiResponse<AdminProfileDto>> {
  return apiClient.patch<AdminProfileDto>('/admin/profile', payload);
}
