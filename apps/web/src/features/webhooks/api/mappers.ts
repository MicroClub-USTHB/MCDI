import type { WebhookDto, WebhookListResponseDto } from '@/features/webhooks/types';

export interface WebhookView {
  id: string;
  name: string;
  channelId: string;
  /** `#name` from the bot cache, or the raw ID when the bot can't see the channel. */
  channelLabel: string;
  serverId: string;
  serverLabel: string;
  usageCount: number;
  lastUsedLabel: string;
  createdAtLabel: string;
}

export interface WebhookListView {
  webhooks: WebhookView[];
  total: number;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Copies only display fields, so nothing secret can reach the UI by accident. */
export function mapWebhookResponse(dto: WebhookDto): WebhookView {
  return {
    id: dto.id,
    name: dto.name,
    channelId: dto.channelId,
    channelLabel: dto.channelName ? `#${dto.channelName}` : dto.channelId,
    serverId: dto.serverId,
    serverLabel: dto.serverName ?? dto.serverId,
    usageCount: dto.usageCount,
    lastUsedLabel: formatDate(dto.lastUsedAt) ?? 'Never',
    createdAtLabel: formatDate(dto.createdAt) ?? '—',
  };
}

export function mapWebhookList(dto: WebhookListResponseDto): WebhookListView {
  return { webhooks: dto.webhooks.map(mapWebhookResponse), total: dto.total };
}
