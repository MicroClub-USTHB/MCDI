import type { PaginatedResponse } from '@/shared/types';
import type {
  SyncChangeDetailDto,
  SyncChangeDetailsResponseDto,
  SyncLogDto,
  SyncLogsResponseDto,
  SyncStatusDto,
} from '@/features/sync/types';

export interface SyncStatusSummary {
  label: string;
  tone: 'success' | 'warning' | 'error';
}

/**
 * Collapses per-server sync status into one headline for the dashboard's
 * quick-stats card. Priority: anything actively running > anything failed >
 * all quiet.
 */
export function summarizeSyncStatus(statuses: SyncStatusDto[]): SyncStatusSummary {
  if (statuses.some((s) => s.status === 'in_progress' || s.status === 'queued')) {
    return { label: 'Syncing', tone: 'warning' };
  }
  if (statuses.some((s) => s.status === 'failed')) {
    return { label: 'Sync failed', tone: 'error' };
  }
  return { label: 'All synced', tone: 'success' };
}

export type SyncTone = 'success' | 'warning' | 'error' | 'neutral';

export interface SyncStatusMeta {
  label: string;
  tone: SyncTone;
  /** `true` while the backend is still working the server — drives the pulsing indicator and the 30s poll. */
  isActive: boolean;
}

export const SYNC_STATUS_META: Record<SyncStatusDto['status'], SyncStatusMeta> = {
  never: { label: 'Never synced', tone: 'neutral', isActive: false },
  queued: { label: 'Queued', tone: 'warning', isActive: true },
  in_progress: { label: 'Syncing', tone: 'warning', isActive: true },
  success: { label: 'Synced', tone: 'success', isActive: false },
  failed: { label: 'Failed', tone: 'error', isActive: false },
};

export interface SyncServerStatus {
  serverId: string;
  status: SyncStatusDto['status'];
  meta: SyncStatusMeta;
  lastSyncAt: string | null;
  membersSynced: number;
  rolesSynced: number;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export function mapSyncStatus(dto: SyncStatusDto): SyncServerStatus {
  return {
    serverId: dto.serverId,
    status: dto.status,
    meta: SYNC_STATUS_META[dto.status],
    lastSyncAt: dto.lastSyncAt,
    membersSynced: dto.membersSynced,
    rolesSynced: dto.rolesSynced,
    message: dto.message ?? null,
    startedAt: dto.startedAt,
    finishedAt: dto.finishedAt ?? null,
  };
}

export function mapSyncStatusList(dtos: SyncStatusDto[]): SyncServerStatus[] {
  return dtos.map(mapSyncStatus);
}

/** A placeholder status for a server the status endpoint hasn't reported on yet. */
export function neverSyncedStatus(serverId: string): SyncServerStatus {
  return {
    serverId,
    status: 'never',
    meta: SYNC_STATUS_META.never,
    lastSyncAt: null,
    membersSynced: 0,
    rolesSynced: 0,
    message: null,
    startedAt: '',
    finishedAt: null,
  };
}

/** Whether any server is still queued or in progress — the signal to keep polling status. */
export function isSyncActive(statuses: Pick<SyncStatusDto, 'status'>[]): boolean {
  return statuses.some((s) => SYNC_STATUS_META[s.status]?.isActive ?? false);
}

/** Poll cadence while a sync is running — the backend reports no progress %, so we re-pull status instead. */
export const ACTIVE_SYNC_REFETCH_MS = 30_000;

/** React Query `refetchInterval` value: poll every 30s while a sync is active, otherwise stop. */
export function syncRefetchInterval(
  statuses: Pick<SyncStatusDto, 'status'>[] | undefined
): number | false {
  return statuses && isSyncActive(statuses) ? ACTIVE_SYNC_REFETCH_MS : false;
}

export interface SyncLogEntry {
  id: number;
  serverId: string;
  syncType: SyncLogDto['syncType'];
  status: SyncLogDto['status'];
  meta: SyncStatusMeta;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  membersSynced: number;
  rolesSynced: number;
  message: string | null;
}

export function mapSyncLogEntry(dto: SyncLogDto): SyncLogEntry {
  const finishedAt = dto.finishedAt ?? null;
  const rawDuration =
    finishedAt !== null ? new Date(finishedAt).getTime() - new Date(dto.startedAt).getTime() : null;

  return {
    id: dto.id,
    serverId: dto.serverId,
    syncType: dto.syncType,
    status: dto.status,
    meta: SYNC_STATUS_META[dto.status],
    startedAt: dto.startedAt,
    finishedAt,
    durationMs: rawDuration !== null && Number.isFinite(rawDuration) ? rawDuration : null,
    membersSynced: dto.membersSynced,
    rolesSynced: dto.rolesSynced,
    message: dto.message ?? null,
  };
}

/** `dto` is `limit`/`offset` paginated (`{ logs, total }`); `page`/`pageSize` come from the caller's window. */
export function mapSyncLogsResponse(
  dto: SyncLogsResponseDto,
  page: number,
  pageSize: number
): PaginatedResponse<SyncLogEntry> {
  return {
    data: dto.logs.map(mapSyncLogEntry),
    total: dto.total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(dto.total / pageSize)),
  };
}

const CHANGE_ACTION_TONE: Record<SyncChangeDetailDto['action'], SyncTone> = {
  added: 'success',
  role_assigned: 'success',
  updated: 'warning',
  removed: 'error',
  role_removed: 'error',
  deactivated: 'error',
};

export interface SyncChangeEntry {
  id: number;
  entityType: SyncChangeDetailDto['entityType'];
  entityId: string;
  action: SyncChangeDetailDto['action'];
  tone: SyncTone;
  description: string | null;
  details: string | null;
  createdAt: string;
}

export function mapSyncChangeEntry(dto: SyncChangeDetailDto): SyncChangeEntry {
  return {
    id: dto.id,
    entityType: dto.entityType,
    entityId: dto.entityId,
    action: dto.action,
    tone: CHANGE_ACTION_TONE[dto.action],
    description: dto.description ?? null,
    details: dto.details ?? null,
    createdAt: dto.createdAt,
  };
}

/** `dto` is `limit`/`offset` paginated (`{ changes, total }`); `page`/`pageSize` come from the caller's window. */
export function mapSyncChangesResponse(
  dto: SyncChangeDetailsResponseDto,
  page: number,
  pageSize: number
): PaginatedResponse<SyncChangeEntry> {
  return {
    data: dto.changes.map(mapSyncChangeEntry),
    total: dto.total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(dto.total / pageSize)),
  };
}
