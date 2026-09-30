import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  CreateServerPayload,
  DisableServerPayload,
  ServerDto,
  ServerListItemDto,
  UpdateServerPayload,
} from '@/features/servers/types';

/** `GET /api/servers` returns the full list — there's no pagination on it. */
export function fetchServers(): Promise<ApiResponse<ServerListItemDto[]>> {
  return apiClient.get<ServerListItemDto[]>('/servers');
}

/** No `lastSyncAt`/`botConnected` join extras here — those only exist on the list endpoint. */
export function fetchServer(id: string): Promise<ApiResponse<ServerDto>> {
  return apiClient.get<ServerDto>(`/servers/${id}`);
}

/** 409s if `payload.isMain === false` is sent for the current main server. */
export function updateServer(
  id: string,
  payload: UpdateServerPayload
): Promise<ApiResponse<ServerDto>> {
  return apiClient.patch<ServerDto>(`/servers/${id}`, payload);
}

/** Upserts by `guildId` — registering an already-known guild updates it instead of erroring. */
export function createServer(payload: CreateServerPayload): Promise<ApiResponse<ServerDto>> {
  return apiClient.post<ServerDto>('/servers', payload);
}

/** 409s if the target is the main server — the backend never allows disabling it. */
export function disableServer(
  id: string,
  payload: DisableServerPayload
): Promise<ApiResponse<ServerDto>> {
  return apiClient.patch<ServerDto>(`/servers/${id}/disable`, payload);
}

export function enableServer(id: string): Promise<ApiResponse<ServerDto>> {
  return apiClient.patch<ServerDto>(`/servers/${id}/enable`);
}

/** 409s if the target is the main server. Returns 204 with an empty body on success. */
export function deleteServer(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/servers/${id}`);
}
