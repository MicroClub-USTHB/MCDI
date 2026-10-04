export const sync = {
  name: 'Sync',
  route: '/dashboard/sync',
} as const;

export { syncKeys } from './api/keys';
export {
  fetchSyncStatusAll,
  fetchSyncStatus,
  fetchSyncLogs,
  fetchSyncChanges,
  triggerFullSync,
} from './api/service';
export {
  useSyncStatusAllQuery,
  useSyncStatusQuery,
  useSyncLogsQuery,
  useSyncChangesQuery,
  SYNC_LOG_PAGE_SIZE,
  SYNC_CHANGES_PAGE_SIZE,
} from './api/queries';
export { useTriggerSyncMutation } from './api/mutations';
export {
  summarizeSyncStatus,
  mapSyncStatus,
  mapSyncStatusList,
  mapSyncLogEntry,
  mapSyncLogsResponse,
  mapSyncChangeEntry,
  mapSyncChangesResponse,
  neverSyncedStatus,
  isSyncActive,
  syncRefetchInterval,
  ACTIVE_SYNC_REFETCH_MS,
  SYNC_STATUS_META,
} from './api/mappers';
export { formatRelativeTime, formatAbsoluteTime, formatDuration } from './lib/format';
export {
  SyncStatusCard,
  SyncTriggerButton,
  SyncProgressIndicator,
  SyncLogTable,
  SyncChangeDetail,
} from './components';
export type {
  SyncStatusDto,
  SyncLogDto,
  SyncLogsResponseDto,
  SyncChangeDetailDto,
  SyncChangeDetailsResponseDto,
  SyncTriggerServerResultDto,
  TriggerFullSyncPayload,
  TriggerFullSyncResultDto,
} from './types';
export type {
  SyncStatusSummary,
  SyncStatusMeta,
  SyncTone,
  SyncServerStatus,
  SyncLogEntry,
  SyncChangeEntry,
} from './api/mappers';
