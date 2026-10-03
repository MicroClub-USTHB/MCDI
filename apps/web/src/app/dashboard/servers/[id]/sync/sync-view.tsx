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
  ServerSelector,
  SyncLogTable,
  SyncProgressIndicator,
  SyncStatusCard,
  SyncTriggerButton,
} from '@/features/sync/components';
import type { TriggerFullSyncPayload } from '@/features/sync/types';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { LoadingSkeleton } from '@/shared/components/common';

export default function SyncPage() {
  const router = useRouter();
  const serversQuery = useServersQuery();
  const statusQuery = useSyncStatusAllQuery();
  const triggerMutation = useTriggerSyncMutation();

  const servers = useMemo(
    () => (serversQuery.data ?? []).map((server) => ({ id: server.id, name: server.name })),
    [serversQuery.data]
  );

  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [logsPage, setLogsPage] = useState(1);

  const activeServerId = selectedServerId ?? servers[0]?.id ?? null;

  const logsQuery = useSyncLogsQuery(activeServerId ?? '', logsPage);

  const statuses = useMemo(() => mapSyncStatusList(statusQuery.data ?? []), [statusQuery.data]);
  const statusByServer = useMemo(
    () => new Map(statuses.map((status) => [status.serverId, status])),
    [statuses]
  );
  const anyActive = isSyncActive(statusQuery.data ?? []);

  function handleTrigger(payload: TriggerFullSyncPayload) {
    triggerMutation.mutate(payload);
  }

  function handleServerChange(serverId: string) {
    setSelectedServerId(serverId);
    setLogsPage(1);
  }

  const logs = logsQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-hero">Sync</h1>
          <p className="mt-1 max-w-2xl text-body text-text-muted">
            Monitor Discord ⇆ MCDI synchronization and trigger a full sync per server or across all
            of them.
          </p>
        </div>
        <SyncTriggerButton
          target="all"
          onTrigger={handleTrigger}
          isPending={triggerMutation.isPending}
          disabled={anyActive || servers.length === 0}
        />
      </header>

      <SyncProgressIndicator inProgress={anyActive} />

      {statusQuery.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <LoadingSkeleton key={index} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : statusQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load sync status"
          description="The sync status could not be retrieved right now. Try again in a moment."
          actionLabel="Retry"
          onAction={() => void statusQuery.refetch()}
        />
      ) : servers.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="No servers to sync"
          description="Connect a Discord server before running a sync."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <SyncStatusCard
              key={server.id}
              serverName={server.name}
              status={statusByServer.get(server.id) ?? neverSyncedStatus(server.id)}
              action={
                <SyncTriggerButton
                  target="server"
                  serverIds={[server.id]}
                  size="sm"
                  onTrigger={handleTrigger}
                  isPending={triggerMutation.isPending}
                  disabled={anyActive}
                />
              }
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-heading text-text-primary">Sync history</h2>
            <p className="mt-1 text-body text-text-muted">
              Select a server to view its sync log. Open a run for its change details.
            </p>
          </div>
          <ServerSelector
            servers={servers}
            selected={activeServerId}
            onChange={handleServerChange}
          />
        </div>

        {!activeServerId ? (
          <EmptyState
            icon={RefreshCw}
            title="No server selected"
            description="Pick a server to see its sync history."
          />
        ) : logsQuery.isError ? (
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
            onSelectLog={(log) =>
              router.push(
                log.status === 'failed' && log.message
                  ? `/dashboard/sync/logs/${log.id}?error=${encodeURIComponent(log.message)}`
                  : `/dashboard/sync/logs/${log.id}`
              )
            }
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
