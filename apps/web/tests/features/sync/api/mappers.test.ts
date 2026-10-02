import { describe, expect, it } from 'vitest';

import {
  ACTIVE_SYNC_REFETCH_MS,
  isSyncActive,
  mapSyncChangesResponse,
  mapSyncLogEntry,
  mapSyncLogsResponse,
  mapSyncStatus,
  neverSyncedStatus,
  summarizeSyncStatus,
  syncRefetchInterval,
} from '@/features/sync/api/mappers';
import type { SyncChangeDetailDto, SyncLogDto, SyncStatusDto } from '@/features/sync/types';

function statusDto(overrides: Partial<SyncStatusDto> = {}): SyncStatusDto {
  return {
    serverId: 's1',
    lastSyncAt: '2026-08-28T10:00:00.000Z',
    status: 'success',
    membersSynced: 12,
    rolesSynced: 3,
    startedAt: '2026-08-28T09:59:00.000Z',
    finishedAt: '2026-08-28T10:00:00.000Z',
    ...overrides,
  };
}

function logDto(overrides: Partial<SyncLogDto> = {}): SyncLogDto {
  return {
    id: 1,
    serverId: 's1',
    syncType: 'full',
    status: 'success',
    startedAt: '2026-08-28T09:59:00.000Z',
    finishedAt: '2026-08-28T09:59:12.000Z',
    membersSynced: 12,
    rolesSynced: 3,
    ...overrides,
  };
}

function changeDto(overrides: Partial<SyncChangeDetailDto> = {}): SyncChangeDetailDto {
  return {
    id: 1,
    syncLogId: 1,
    serverId: 's1',
    entityType: 'member',
    entityId: '987654321098765432',
    action: 'added',
    createdAt: '2026-08-28T09:59:05.000Z',
    ...overrides,
  };
}

describe('summarizeSyncStatus', () => {
  it('prioritises active over failed over quiet', () => {
    expect(
      summarizeSyncStatus([statusDto({ status: 'failed' }), statusDto({ status: 'in_progress' })])
    ).toEqual({ label: 'Syncing', tone: 'warning' });
    expect(
      summarizeSyncStatus([statusDto({ status: 'success' }), statusDto({ status: 'failed' })])
    ).toEqual({ label: 'Sync failed', tone: 'error' });
    expect(summarizeSyncStatus([statusDto({ status: 'success' })])).toEqual({
      label: 'All synced',
      tone: 'success',
    });
  });
});

describe('isSyncActive / syncRefetchInterval (auto-refresh logic)', () => {
  it('treats queued and in_progress as active', () => {
    expect(isSyncActive([{ status: 'queued' }])).toBe(true);
    expect(isSyncActive([{ status: 'in_progress' }])).toBe(true);
  });

  it('treats settled states as inactive', () => {
    expect(isSyncActive([{ status: 'success' }, { status: 'failed' }, { status: 'never' }])).toBe(
      false
    );
    expect(isSyncActive([])).toBe(false);
  });

  it('polls every 30s only while something is active', () => {
    expect(syncRefetchInterval(undefined)).toBe(false);
    expect(syncRefetchInterval([{ status: 'success' }])).toBe(false);
    expect(syncRefetchInterval([{ status: 'success' }, { status: 'in_progress' }])).toBe(
      ACTIVE_SYNC_REFETCH_MS
    );
    expect(ACTIVE_SYNC_REFETCH_MS).toBe(30_000);
  });
});

describe('mapSyncStatus', () => {
  it('attaches status metadata and normalises optional fields', () => {
    const mapped = mapSyncStatus(statusDto({ status: 'failed', message: undefined }));
    expect(mapped.meta).toEqual({ label: 'Failed', tone: 'error', isActive: false });
    expect(mapped.message).toBeNull();
  });

  it('builds a never-synced placeholder for servers with no status row', () => {
    const placeholder = neverSyncedStatus('s9');
    expect(placeholder).toMatchObject({ serverId: 's9', status: 'never', lastSyncAt: null });
    expect(placeholder.meta.tone).toBe('neutral');
  });
});

describe('mapSyncLogEntry / mapSyncLogsResponse', () => {
  it('derives duration from the start/finish span', () => {
    expect(mapSyncLogEntry(logDto()).durationMs).toBe(12_000);
    expect(mapSyncLogEntry(logDto({ finishedAt: undefined })).durationMs).toBeNull();
  });

  it('reshapes the limit/offset envelope into a PaginatedResponse for the given window', () => {
    const response = mapSyncLogsResponse(
      {
        logs: [logDto(), logDto({ id: 2, status: 'failed', message: 'boom' })],
        total: 45,
      },
      2,
      20
    );
    expect(response).toMatchObject({ total: 45, page: 2, pageSize: 20, totalPages: 3 });
    expect(response.data).toHaveLength(2);
    expect(response.data[1]?.meta.tone).toBe('error');
  });
});

describe('mapSyncChangesResponse', () => {
  it('maps actions to tones and reshapes the limit/offset envelope into a PaginatedResponse window', () => {
    const response = mapSyncChangesResponse(
      {
        total: 250,
        changes: [
          changeDto({ id: 1, action: 'added' }),
          changeDto({ id: 2, action: 'role_removed' }),
          changeDto({
            id: 3,
            action: 'updated',
            description: 'nickname changed',
            details: '{"a":1}',
          }),
        ],
      },
      2,
      100
    );

    expect(response).toMatchObject({ total: 250, page: 2, pageSize: 100, totalPages: 3 });
    const [added, removed, updated] = response.data;
    expect(added?.tone).toBe('success');
    expect(added?.description).toBeNull();
    expect(removed?.tone).toBe('error');
    expect(updated?.tone).toBe('warning');
    expect(updated?.details).toBe('{"a":1}');
  });

  it('always reports at least one page, even with no changes', () => {
    expect(mapSyncChangesResponse({ total: 0, changes: [] }, 1, 100).totalPages).toBe(1);
  });
});
