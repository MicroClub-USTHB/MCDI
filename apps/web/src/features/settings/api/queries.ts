'use client';

import { useQuery } from '@tanstack/react-query';

import { settingsKeys } from '@/features/settings/api/keys';
import { getProfile, getSettings } from '@/features/settings/api/service';
import { mapProfileResponse, mapSettingsResponse } from '@/features/settings/api/mappers';

export function useSettingsQuery() {
  return useQuery({
    queryKey: settingsKeys.settings(),
    queryFn: async () => mapSettingsResponse((await getSettings()).data),
  });
}

export function useProfileQuery() {
  return useQuery({
    queryKey: settingsKeys.profile(),
    queryFn: async () => mapProfileResponse((await getProfile()).data),
  });
}
