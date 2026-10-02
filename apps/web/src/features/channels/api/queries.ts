'use client';

import { useQuery } from '@tanstack/react-query';
import { channelKeys } from '@/features/channels/api/keys';
import { fetchChannel, fetchChannels, fetchMessageHistory } from '@/features/channels/api/service';
import { mapChannelDetail, mapChannelTree, mapMessageList } from '@/features/channels/api/mappers';
import { MESSAGE_HISTORY_LIMIT } from '@/features/channels/types';

export function useChannelsQuery(serverId: string | null) {
  return useQuery({
    queryKey: channelKeys.lists(serverId ?? ''),
    queryFn: async () => {
      const response = await fetchChannels(serverId as string);
      return mapChannelTree(response.data);
    },
    enabled: Boolean(serverId),
  });
}

export function useChannelQuery(serverId: string | null, channelId: string | null) {
  return useQuery({
    queryKey: channelKeys.detail(serverId ?? '', channelId ?? ''),
    queryFn: async () => {
      const response = await fetchChannel(serverId as string, channelId as string);
      return mapChannelDetail(response.data);
    },
    enabled: Boolean(serverId) && Boolean(channelId),
  });
}

/**
 * Message history is opt-in (issue AC: "loads on demand, last 50 messages") —
 * the caller flips `enabled` when the user asks for it.
 */
export function useMessageHistoryQuery(
  serverId: string | null,
  channelId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: channelKeys.messages(serverId ?? '', channelId ?? ''),
    queryFn: async () => {
      const response = await fetchMessageHistory(
        serverId as string,
        channelId as string,
        MESSAGE_HISTORY_LIMIT
      );
      return {
        messages: mapMessageList(response.data.messages),
        hasMore: response.data.hasMore,
      };
    },
    enabled: enabled && Boolean(serverId) && Boolean(channelId),
  });
}
