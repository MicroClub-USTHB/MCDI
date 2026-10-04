'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboundWebhookKeys } from '@/features/inbound-webhooks/api/keys';
import {
  createInboundWebhook,
  updateInboundSettings,
  updateInboundWebhook,
} from '@/features/inbound-webhooks/api/service';
import type {
  CreateInboundWebhookPayload,
  UpdateInboundWebhookPayload,
} from '@/features/inbound-webhooks/types';

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

/** The docs are generated from the webhook's options, so a change refreshes them too. */
export function useUpdateInboundWebhookMutation(webhookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: UpdateInboundWebhookPayload) => updateInboundWebhook(webhookId, patch),
    onSuccess: (response) => {
      queryClient.setQueryData(inboundWebhookKeys.detail(webhookId), response.data);
      void queryClient.invalidateQueries({ queryKey: inboundWebhookKeys.docs(webhookId) });
      void queryClient.invalidateQueries({
        queryKey: inboundWebhookKeys.lists(response.data.projectId),
      });
    },
  });
}
