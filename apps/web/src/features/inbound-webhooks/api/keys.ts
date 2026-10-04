import type { PreviewSchemaPayload } from '@/features/inbound-webhooks/types';

export const inboundWebhookKeys = {
  all: ['inbound-webhooks'] as const,
  lists: (projectId: string) => [...inboundWebhookKeys.all, 'list', projectId] as const,
  roles: (webhookId: string) => [...inboundWebhookKeys.all, 'roles', webhookId] as const,
  settings: () => [...inboundWebhookKeys.all, 'settings'] as const,
  preview: (payload: PreviewSchemaPayload) =>
    [...inboundWebhookKeys.all, 'preview', payload] as const,
};
