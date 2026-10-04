'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboundWebhookKeys } from '@/features/inbound-webhooks/api/keys';
import {
  createInboundWebhook,
  updateInboundSettings,
} from '@/features/inbound-webhooks/api/service';
import type { CreateInboundWebhookPayload } from '@/features/inbound-webhooks/types';

export function useCreateInboundWebhookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInboundWebhookPayload) => createInboundWebhook(payload),
    onSuccess: (_response, payload) => {
      void queryClient.invalidateQueries({
        queryKey: inboundWebhookKeys.lists(payload.projectId),
      });
    },
  });
}

export function useUpdateInboundSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (defaultReaderRoleIds: string[]) => updateInboundSettings(defaultReaderRoleIds),
    onSuccess: (response) => {
      queryClient.setQueryData(inboundWebhookKeys.settings(), response.data);
    },
  });
}
