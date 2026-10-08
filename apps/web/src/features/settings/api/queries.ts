'use client';

import { useQuery } from '@tanstack/react-query';

import { settingsKeys } from '@/features/settings/api/keys';
import { getProfile, getSettings } from '@/features/settings/api/service';
import { mapProfileResponse, mapSettingsResponse } from '@/features/settings/api/mappers';
import { useCan } from '@/shared/lib/use-access';

export function useSettingsQuery() {
  const allowed = useCan('settings', 'read');
  return useQuery({
    queryKey: settingsKeys.settings(),
    queryFn: async () => mapSettingsResponse((await getSettings()).data),
    enabled: allowed,
  });
}

export function useProfileQuery() {
  return useQuery({
    queryKey: settingsKeys.profile(),
    queryFn: async () => mapProfileResponse((await getProfile()).data),
  });
}
