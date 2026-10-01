import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  ChannelDetailDto,
  ChannelListResponseDto,
  MessageHistoryResponseDto,
} from '@/features/channels/types';
import { MESSAGE_HISTORY_LIMIT } from '@/features/channels/types';

/** Admin-session channel routes are read-only: `GET /api/admin/servers/:id/channels…`. */
function base(serverId: string): string {
  return `/admin/servers/${encodeURIComponent(serverId)}/channels`;
}

export function fetchChannels(serverId: string): Promise<ApiResponse<ChannelListResponseDto>> {
  return apiClient.get<ChannelListResponseDto>(base(serverId));
}

export function fetchChannel(
  serverId: string,
  channelId: string
): Promise<ApiResponse<ChannelDetailDto>> {
  return apiClient.get<ChannelDetailDto>(`${base(serverId)}/${encodeURIComponent(channelId)}`);
}

export function fetchMessageHistory(
  serverId: string,
  channelId: string,
  limit: number = MESSAGE_HISTORY_LIMIT
): Promise<ApiResponse<MessageHistoryResponseDto>> {
  const params = new URLSearchParams({
    limit: String(Math.min(100, Math.max(1, Math.trunc(limit) || MESSAGE_HISTORY_LIMIT))),
  });
  return apiClient.get<MessageHistoryResponseDto>(
    `${base(serverId)}/${encodeURIComponent(channelId)}/messages?${params.toString()}`
  );
}
