export const settingsKeys = {
  all: ['settings'] as const,
  settings: () => [...settingsKeys.all, 'detail'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
} as const;
