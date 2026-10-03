/** `WebhookSummaryDto` from the API. The webhook URL and token are never sent. */
export interface WebhookDto {
  id: string;
  name: string;
  channelId: string;
  /** Resolved from the bot cache; null when the bot can't see the channel. */
  channelName: string | null;
  serverId: string;
  serverName: string | null;
  createdAt: string;
  usageCount: number;
  lastUsedAt: string | null;
}

/** `GET /api/admin/projects/:projectId/webhooks` */
export interface WebhookListResponseDto {
  webhooks: WebhookDto[];
  total: number;
  limit: number;
  offset: number;
}
