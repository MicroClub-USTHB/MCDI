'use client';

import { useQuery } from '@tanstack/react-query';
import { webhookKeys } from '@/features/webhooks/api/keys';
import { fetchWebhooks } from '@/features/webhooks/api/service';
import { mapWebhookList } from '@/features/webhooks/api/mappers';

export function useWebhooksQuery(projectId: string | null) {
  return useQuery({
    queryKey: webhookKeys.lists(projectId ?? ''),
    queryFn: async () => {
      const response = await fetchWebhooks(projectId as string);
      return mapWebhookList(response.data);
    },
    enabled: Boolean(projectId),
  });
}
