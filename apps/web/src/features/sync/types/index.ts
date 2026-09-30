import type {
  SyncChangeAction,
  SyncEntityType,
  SyncLogStatus,
  SyncStatus,
  SyncType,
} from '@mcdi/contracts';

/** Raw shape returned by `GET /api/admin/sync/status/all` and `/status`, one entry per server. */
export interface SyncStatusDto {
  serverId: string;
  lastSyncAt: string | null;
  status: SyncStatus;
  membersSynced: number;
  rolesSynced: number;
  message?: string;
  startedAt: string;
  finishedAt?: string;
}

/** One row of `GET /api/admin/sync/logs` — a past sync run for a single server. */
export interface SyncLogDto {
  id: number;
  serverId: string;
  syncType: SyncType;
  status: SyncLogStatus;
  membersSynced: number;
  rolesSynced: number;
  message?: string;
  startedAt: string;
  finishedAt?: string;
}

/** `GET /api/admin/sync/logs` envelope — `limit`/`offset` paginated, so the page is derived client-side. */
export interface SyncLogsResponseDto {
  logs: SyncLogDto[];
  total: number;
}

/** One granular change from `GET /api/admin/sync/logs/:syncLogId/changes`. */
export interface SyncChangeDetailDto {
  id: number;
  syncLogId: number;
  serverId: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncChangeAction;
  description?: string;
  /** JSON string of the before/after payload, when the backend recorded one. */
  details?: string;
  createdAt: string;
}

export interface SyncChangeDetailsResponseDto {
  changes: SyncChangeDetailDto[];
  total: number;
}

/** Body for `POST /api/admin/sync/full`. Omit `serverIds` to sync every active server. */
export interface TriggerFullSyncPayload {
  serverIds?: string[];
  target?: 'all' | 'members' | 'roles';
}

export interface SyncTriggerServerResultDto {
  serverId: string;
  syncId?: number;
  error?: string;
}

/** `POST /api/admin/sync/full` returns per-server results so partial failures are visible. */
export interface TriggerFullSyncResultDto {
  results: SyncTriggerServerResultDto[];
}
