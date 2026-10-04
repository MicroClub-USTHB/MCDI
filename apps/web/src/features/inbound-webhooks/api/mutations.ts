'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { inboundWebhookKeys } from '@/features/inbound-webhooks/api/keys';
import {
  createInboundWebhook,
  deleteInboundWebhook,
  replaceAllowedRoles,
  rotateSigningSecret,
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

/** `gcTime: 0` so the new secret does not linger in the mutation cache after it has been shown. */
export function useRotateSecretMutation(webhookId: string) {
  return useMutation({
    mutationFn: () => rotateSigningSecret(webhookId),
    gcTime: 0,
  });
}

export function useDeleteInboundWebhookMutation(webhookId: string, projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteInboundWebhook(webhookId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: inboundWebhookKeys.detail(webhookId) });
      void queryClient.invalidateQueries({ queryKey: inboundWebhookKeys.lists(projectId) });
    },
  });
}

export function useReplaceAllowedRolesMutation(webhookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleIds: string[]) => replaceAllowedRoles(webhookId, roleIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: inboundWebhookKeys.roles(webhookId) });
    },
  });
}
