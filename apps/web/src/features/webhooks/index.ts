export const webhooks = {
  name: 'Webhooks',
  route: '/dashboard/webhooks',
} as const;

export { webhookKeys } from './api/keys';
export { fetchWebhooks, deleteWebhook } from './api/service';
export { useWebhooksQuery } from './api/queries';
export { useDeleteWebhookMutation } from './api/mutations';
export { mapWebhookResponse, mapWebhookList } from './api/mappers';
export type { WebhookView, WebhookListView } from './api/mappers';
export type { WebhookDto, WebhookListResponseDto } from './types';
