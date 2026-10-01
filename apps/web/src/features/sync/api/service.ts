import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  SyncChangeDetailsResponseDto,
  SyncLogsResponseDto,
  SyncStatusDto,
  TriggerFullSyncPayload,
  TriggerFullSyncResultDto,
} from '@/features/sync/types';

export function fetchSyncStatusAll(): Promise<ApiResponse<SyncStatusDto[]>> {
  return apiClient.get<SyncStatusDto[]>('/admin/sync/status/all');
}

export function fetchSyncStatus(serverId: string): Promise<ApiResponse<SyncStatusDto>> {
  return apiClient.get<SyncStatusDto>(
    `/admin/sync/status?serverId=${encodeURIComponent(serverId)}`
  );
}

export function fetchSyncLogs(
  serverId: string,
  limit: number,
  offset: number
): Promise<ApiResponse<SyncLogsResponseDto>> {
  const params = new URLSearchParams({
    serverId,
    limit: String(Math.max(1, Math.trunc(limit) || 1)),
    offset: String(Math.max(0, Math.trunc(offset) || 0)),
  });
  return apiClient.get<SyncLogsResponseDto>(`/admin/sync/logs?${params.toString()}`);
}

export function fetchSyncChanges(
  syncLogId: number,
  limit: number,
  offset: number
): Promise<ApiResponse<SyncChangeDetailsResponseDto>> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiClient.get<SyncChangeDetailsResponseDto>(
    `/admin/sync/logs/${syncLogId}/changes?${params.toString()}`
  );
}

export function triggerFullSync(
  payload: TriggerFullSyncPayload
): Promise<ApiResponse<TriggerFullSyncResultDto>> {
  return apiClient.post<TriggerFullSyncResultDto>('/admin/sync/full', payload);
}
