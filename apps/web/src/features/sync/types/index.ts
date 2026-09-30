/** Raw shape returned by `GET /api/admin/sync/status/all` and `/status`, one entry per server. */
export interface SyncStatusDto {
  serverId: string;
  lastSyncAt: string | null;
  status: 'queued' | 'in_progress' | 'success' | 'failed' | 'never';
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
  syncType: 'full' | 'incremental' | 'manual';
  status: 'queued' | 'in_progress' | 'success' | 'failed';
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
  entityType: 'member' | 'role' | 'server';
  entityId: string;
  action: 'added' | 'removed' | 'updated' | 'deactivated' | 'role_assigned' | 'role_removed';
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
