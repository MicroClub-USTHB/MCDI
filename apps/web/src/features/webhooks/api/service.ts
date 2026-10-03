import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type { WebhookListResponseDto } from '@/features/webhooks/types';

/** The API caps a page at 100; a project holds far fewer webhooks, so one page is the whole list. */
const LIST_LIMIT = 100;

/**
 * Admin-session webhook routes are read + delete only. Create, update and
 * test-send need the owning project's API key, so the admin panel has none.
 */
export function fetchWebhooks(projectId: string): Promise<ApiResponse<WebhookListResponseDto>> {
  return apiClient.get<WebhookListResponseDto>(
    `/admin/projects/${encodeURIComponent(projectId)}/webhooks?limit=${LIST_LIMIT}`
  );
}

export function deleteWebhook(webhookId: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/admin/webhooks/${encodeURIComponent(webhookId)}`);
}
