'use client';

import { useQuery } from '@tanstack/react-query';
import { webhookKeys } from '@/features/webhooks/api/keys';
import { fetchWebhooks } from '@/features/webhooks/api/service';
import { mapWebhookList } from '@/features/webhooks/api/mappers';
import { useCan } from '@/shared/lib/use-access';

export function useWebhooksQuery(projectId: string | null) {
  const allowed = useCan('webhooks', 'read');
  return useQuery({
    queryKey: webhookKeys.lists(projectId ?? ''),
    queryFn: async () => {
      const response = await fetchWebhooks(projectId as string);
      return mapWebhookList(response.data);
    },
    enabled: allowed && Boolean(projectId),
  });
}
