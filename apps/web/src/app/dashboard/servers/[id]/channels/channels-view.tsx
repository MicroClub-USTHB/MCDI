'use client';

import { useState } from 'react';
import { AlertCircle, Hash } from 'lucide-react';

import {
  useChannelQuery,
  useChannelsQuery,
  useMessageHistoryQuery,
} from '@/features/channels/api/queries';
import { ChannelDetail, ChannelTree, MessageHistory } from '@/features/channels/components';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { LoadingSkeleton } from '@/shared/components/common';

/** Channels of the server in the URL; the sidebar's server switcher picks the server. */
export function ChannelsView({ serverId }: { serverId: string }) {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [historyEnabled, setHistoryEnabled] = useState(false);

  const channelsQuery = useChannelsQuery(serverId);
  const tree = channelsQuery.data;

  const activeChannelId =
    selectedChannelId && tree?.byId.has(selectedChannelId)
      ? selectedChannelId
      : (tree?.firstTextChannelId ?? null);

  const activeChannelNode = activeChannelId ? (tree?.byId.get(activeChannelId) ?? null) : null;

  const channelQuery = useChannelQuery(serverId, activeChannelId);
  const historyQuery = useMessageHistoryQuery(serverId, activeChannelId, historyEnabled);

  function handleChannelSelect(channelId: string) {
    setSelectedChannelId(channelId);
    setHistoryEnabled(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-hero">Channels</h1>
        <p className="mt-1 max-w-2xl text-body text-text-muted">
          Browse this server’s channels by category and read recent message history — without
          leaving MCDI.
        </p>
      </header>

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
    </div>
  );
}
