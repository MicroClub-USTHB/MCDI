export const settings = {
  name: 'Settings',
  route: '/dashboard/settings',
} as const;

export { settingsKeys } from './api/keys';
export {
  getSettings,
  updateSettings,
  resetSettings,
  getProfile,
  updateProfile,
} from './api/service';
export { useSettingsQuery, useProfileQuery } from './api/queries';
export {
  useUpdateSettingsMutation,
  useResetSettingsMutation,
  useUpdateProfileMutation,
} from './api/mutations';
export type {
  SettingValue,
  SecretSetting,
  DiscordSettings,
  CacheSettingsGroup,
  RateLimitSettingsGroup,
  PreferencesSettingsGroup,
  SecuritySettingsGroup,
  SettingsMeta,
  SettingsDto,
  UpdateSettingsPayload,
  AdminProfileDto,
  UpdateProfilePayload,
} from './types';
export * from './components';
