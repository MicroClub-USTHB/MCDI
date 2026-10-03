'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Hash } from 'lucide-react';

import { useServersQuery } from '@/features/servers/api/queries';
import {
  useChannelQuery,
  useChannelsQuery,
  useMessageHistoryQuery,
} from '@/features/channels/api/queries';
import {
  ChannelDetail,
  ChannelTree,
  MessageHistory,
  ServerContextSelector,
} from '@/features/channels/components';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { LoadingSkeleton } from '@/shared/components/common';

export default function ChannelsPage() {
  const serversQuery = useServersQuery();

  const servers = useMemo(
    () => (serversQuery.data ?? []).map((server) => ({ id: server.id, name: server.name })),
    [serversQuery.data]
  );

  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [historyEnabled, setHistoryEnabled] = useState(false);

  const activeServerId = selectedServerId ?? servers[0]?.id ?? null;

  const channelsQuery = useChannelsQuery(activeServerId);
  const tree = channelsQuery.data;

  const activeChannelId =
    selectedChannelId && tree?.byId.has(selectedChannelId)
      ? selectedChannelId
      : (tree?.firstTextChannelId ?? null);

  const activeChannelNode = activeChannelId ? (tree?.byId.get(activeChannelId) ?? null) : null;

  const channelQuery = useChannelQuery(activeServerId, activeChannelId);
  const historyQuery = useMessageHistoryQuery(activeServerId, activeChannelId, historyEnabled);

  function handleServerChange(serverId: string) {
    setSelectedServerId(serverId);
    setSelectedChannelId(null);
    setHistoryEnabled(false);
  }

  function handleChannelSelect(channelId: string) {
    setSelectedChannelId(channelId);
    setHistoryEnabled(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-hero">Channels</h1>
          <p className="mt-1 max-w-2xl text-body text-text-muted">
            Browse a server’s channels by category and read recent message history — without leaving
            MCDI.
          </p>
        </div>
        <ServerContextSelector
          servers={servers}
          selected={activeServerId}
          onChange={handleServerChange}
          disabled={serversQuery.isPending}
        />
      </header>

      {serversQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <LoadingSkeleton className="h-96 rounded-lg" />
          <LoadingSkeleton className="h-96 rounded-lg" />
        </div>
      ) : serversQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load servers"
          description="The server list could not be retrieved right now. Try again in a moment."
          actionLabel="Retry"
          onAction={() => void serversQuery.refetch()}
        />
      ) : servers.length === 0 ? (
        <EmptyState
          icon={Hash}
          title="No servers connected"
          description="Connect a Discord server before browsing its channels."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div>
            {channelsQuery.isPending ? (
              <LoadingSkeleton className="h-96 rounded-lg" />
            ) : channelsQuery.isError ? (
              <EmptyState
                icon={AlertCircle}
                title="Couldn’t load channels"
                description="The server may not exist, or the bot isn’t connected to it."
                actionLabel="Retry"
                onAction={() => void channelsQuery.refetch()}
              />
            ) : !tree || tree.groups.length === 0 ? (
              <EmptyState
                icon={Hash}
                title="No channels"
                description="This server has no channels the bot can see."
              />
            ) : (
              <ChannelTree
                groups={tree.groups}
                selectedId={activeChannelId}
                onSelect={handleChannelSelect}
              />
            )}
          </div>

          <div className="flex flex-col gap-4">
            {!activeChannelId ? (
              <EmptyState
                icon={Hash}
                title="Select a channel"
                description="Pick a channel from the list to see its details."
              />
            ) : (
              <>
                {channelQuery.data ? (
                  <ChannelDetail channel={channelQuery.data} />
                ) : channelQuery.isError ? null : (
                  <LoadingSkeleton className="h-24 rounded-lg" />
                )}

                {activeChannelNode?.hasMessages ? (
                  <MessageHistory
                    messages={historyQuery.data?.messages ?? []}
                    hasMore={historyQuery.data?.hasMore ?? false}
                    loaded={historyEnabled}
                    isLoading={historyQuery.isPending}
                    isError={historyQuery.isError}
                    onLoad={() => setHistoryEnabled(true)}
                    onRetry={() => void historyQuery.refetch()}
                  />
                ) : (
                  <p className="rounded-lg border border-border bg-surface-raised p-4 text-body text-text-muted">
                    This channel type has no readable message history.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
