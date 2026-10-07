'use client';

import { useQuery } from '@tanstack/react-query';
import { syncKeys } from '@/features/sync/api/keys';
import {
  fetchSyncChanges,
  fetchSyncLogs,
  fetchSyncStatus,
  fetchSyncStatusAll,
} from '@/features/sync/api/service';
import {
  mapSyncChangesResponse,
  mapSyncLogsResponse,
  syncRefetchInterval,
} from '@/features/sync/api/mappers';
import { useCan } from '@/shared/lib/use-access';

/** Sync history is `limit`/`offset` paginated on the backend; the UI pages through fixed windows of this size. */
export const SYNC_LOG_PAGE_SIZE = 20;
/** Change details are `limit`/`offset` paginated too; the backend caps `limit` at 100, so that's the window. */
export const SYNC_CHANGES_PAGE_SIZE = 100;

export function useSyncStatusAllQuery() {
  const allowed = useCan('sync', 'read');
  return useQuery({
    queryKey: syncKeys.statusAll(),
    queryFn: async () => {
      const response = await fetchSyncStatusAll();
      return response.data;
    },
    refetchInterval: (query) => syncRefetchInterval(query.state.data),
    enabled: allowed,
  });
}

export function useSyncStatusQuery(serverId: string) {
  const allowed = useCan('sync', 'read');
  return useQuery({
    queryKey: syncKeys.status(serverId),
    queryFn: async () => {
      const response = await fetchSyncStatus(serverId);
      return response.data;
    },
    enabled: allowed && Boolean(serverId),
    refetchInterval: (query) =>
      syncRefetchInterval(query.state.data ? [query.state.data] : undefined),
  });
}

export function useSyncLogsQuery(serverId: string, page: number) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;

  const allowed = useCan('sync', 'read');
  return useQuery({
    queryKey: syncKeys.logs(serverId, safePage),
    queryFn: async () => {
      const offset = (safePage - 1) * SYNC_LOG_PAGE_SIZE;
      const response = await fetchSyncLogs(serverId, SYNC_LOG_PAGE_SIZE, offset);
      return mapSyncLogsResponse(response.data, safePage, SYNC_LOG_PAGE_SIZE);
    },
    enabled: allowed && Boolean(serverId),
    placeholderData: (previousData) => previousData,
  });
}

export function useSyncChangesQuery(syncLogId: number | null, page: number) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;

  const allowed = useCan('sync', 'read');
  return useQuery({
    queryKey: syncKeys.changes(syncLogId ?? 0, safePage),
    queryFn: async () => {
      const offset = (safePage - 1) * SYNC_CHANGES_PAGE_SIZE;
      const response = await fetchSyncChanges(syncLogId as number, SYNC_CHANGES_PAGE_SIZE, offset);
      return mapSyncChangesResponse(response.data, safePage, SYNC_CHANGES_PAGE_SIZE);
    },
    enabled: allowed && syncLogId !== null,
    placeholderData: (previousData) => previousData,
  });
}
