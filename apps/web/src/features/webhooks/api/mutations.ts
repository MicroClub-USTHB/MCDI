'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { webhookKeys } from '@/features/webhooks/api/keys';
import { deleteWebhook } from '@/features/webhooks/api/service';

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(webhookId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: webhookKeys.all });
    },
  });
}
