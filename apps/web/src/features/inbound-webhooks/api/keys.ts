import type { PreviewSchemaPayload, SubmissionFilters } from '@/features/inbound-webhooks/types';

export const inboundWebhookKeys = {
  all: ['inbound-webhooks'] as const,
  lists: (projectId: string) => [...inboundWebhookKeys.all, 'list', projectId] as const,
  detail: (webhookId: string) => [...inboundWebhookKeys.all, 'detail', webhookId] as const,
  docs: (webhookId: string) => [...inboundWebhookKeys.all, 'docs', webhookId] as const,
  submissions: (webhookId: string, filters: SubmissionFilters) =>
    [...inboundWebhookKeys.all, 'submissions', webhookId, filters] as const,
  submission: (webhookId: string, submissionId: string) =>
    [...inboundWebhookKeys.all, 'submission', webhookId, submissionId] as const,
  roles: (webhookId: string) => [...inboundWebhookKeys.all, 'roles', webhookId] as const,
  settings: () => [...inboundWebhookKeys.all, 'settings'] as const,
  preview: (payload: PreviewSchemaPayload) =>
    [...inboundWebhookKeys.all, 'preview', payload] as const,
};
