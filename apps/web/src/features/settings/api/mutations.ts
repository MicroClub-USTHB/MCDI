'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { settingsKeys } from '@/features/settings/api/keys';
import { resetSettings, updateProfile, updateSettings } from '@/features/settings/api/service';
import type { UpdateProfilePayload, UpdateSettingsPayload } from '@/features/settings/types';

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateSettingsPayload) => (await updateSettings(payload)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.settings(), data);
    },
  });
}

export function useResetSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => (await resetSettings()).data,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.settings(), data);
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => (await updateProfile(payload)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.profile(), data);
    },
  });
}
