'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { useServersQuery } from '@/features/servers/api/queries';
import {
  SYNC_LOG_PAGE_SIZE,
  useSyncLogsQuery,
  useSyncStatusAllQuery,
} from '@/features/sync/api/queries';
import { useTriggerSyncMutation } from '@/features/sync/api/mutations';
import { isSyncActive, mapSyncStatusList, neverSyncedStatus } from '@/features/sync/api/mappers';
import {
  SyncLogTable,
  SyncProgressIndicator,
  SyncStatusCard,
  SyncTriggerButton,
} from '@/features/sync/components';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { LoadingSkeleton } from '@/shared/components/common';
import { useCan } from '@/shared/lib/use-access';

/** Sync status and history of the server in the URL. Syncing every server lives on the Servers page. */
export function SyncView({ serverId }: { serverId: string }) {
  const router = useRouter();
  const serversQuery = useServersQuery();
  const statusQuery = useSyncStatusAllQuery();
  const triggerMutation = useTriggerSyncMutation();
  const canSync = useCan('sync', 'write');
  const [logsPage, setLogsPage] = useState(1);
  const logsQuery = useSyncLogsQuery(serverId, logsPage);

  const serverName =
    serversQuery.data?.find((server) => server.id === serverId)?.name ?? 'This server';
  const ownStatuses = useMemo(
    () => (statusQuery.data ?? []).filter((status) => status.serverId === serverId),
    [statusQuery.data, serverId]
  );
  const status = mapSyncStatusList(ownStatuses)[0] ?? neverSyncedStatus(serverId);
  const active = isSyncActive(ownStatuses);
  const logs = logsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-hero">Sync</h1>
        <p className="mt-1 max-w-2xl text-body text-text-muted">
          Monitor Discord ⇆ MCDI synchronization for this server and sync it on demand.
        </p>
      </header>

      <SyncProgressIndicator inProgress={active} />

      {statusQuery.isPending ? (
        <LoadingSkeleton className="h-40 max-w-md rounded-lg" />
      ) : statusQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load sync status"
          description="The sync status could not be retrieved right now. Try again in a moment."
          actionLabel="Retry"
          onAction={() => void statusQuery.refetch()}
        />
      ) : (
        <div className="max-w-md">
          <SyncStatusCard
            serverName={serverName}
            status={status}
            action={
              canSync ? (
                <SyncTriggerButton
                  target="server"
                  serverIds={[serverId]}
                  size="sm"
                  onTrigger={(payload) => triggerMutation.mutate(payload)}
                  isPending={triggerMutation.isPending}
                  disabled={active}
                />
              ) : undefined
            }
          />
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-heading text-text-primary">Sync history</h2>
          <p className="mt-1 text-body text-text-muted">Open a run for its change details.</p>
        </div>

        {logsQuery.isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn’t load sync logs"
            description="The sync history could not be retrieved right now. Try again in a moment."
            actionLabel="Retry"
            onAction={() => void logsQuery.refetch()}
          />
        ) : (
          <SyncLogTable
            logs={logs?.data ?? []}
            isLoading={logsQuery.isLoading}
            onSelectLog={(log) => {
              const run = `/dashboard/servers/${serverId}/sync/logs/${log.id}`;
              router.push(
                log.status === 'failed' && log.message
                  ? `${run}?error=${encodeURIComponent(log.message)}`
                  : run
              );
            }}
            page={logs?.page ?? logsPage}
            pageSize={logs?.pageSize ?? SYNC_LOG_PAGE_SIZE}
            total={logs?.total ?? 0}
            totalPages={logs?.totalPages ?? 1}
            onPageChange={setLogsPage}
            emptyState={
              <EmptyState
                icon={RefreshCw}
                title="No sync history"
                description="This server hasn’t been synced yet."
              />
            }
          />
        )}
      </section>
    </div>
  );
}
