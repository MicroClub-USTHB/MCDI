import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  AccessAuditEntry,
  AccessAuditAction,
  AccessMatrixEntry,
  ApiKeyInfoDto,
  CreateProjectPayload,
  CreateProjectResponse,
  ProjectDto,
  ProjectScope,
  RegenerateApiKeyResponse,
  SetServerAccessPayload,
  UpdateProjectPayload,
} from '@/features/projects/types';

export interface ListProjectsParams {
  isActive?: boolean;
  isInternal?: boolean;
  name?: string;
}

export interface ListAccessMatrixParams {
  projectId?: string;
  serverId?: string;
  scope?: ProjectScope;
  projectName?: string;
}

export interface ListAccessAuditParams {
  limit?: number;
  projectId?: string;
  serverId?: string;
  action?: AccessAuditAction;
}

/** Serializes a params object into a URL search string, dropping undefined. */
function toSearchString<T extends object>(params?: T): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined &&
      (typeof entry[1] === 'string' ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean')
  );
  if (entries.length === 0) return '';
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

/** `GET /api/admin/projects` — full list, no pagination, filterable. */
export function fetchProjects(params?: ListProjectsParams): Promise<ApiResponse<ProjectDto[]>> {
  return apiClient.get<ProjectDto[]>(`/admin/projects${toSearchString(params)}`);
}

/** `GET /api/admin/projects/:id` */
export function fetchProject(id: string): Promise<ApiResponse<ProjectDto>> {
  return apiClient.get<ProjectDto>(`/admin/projects/${id}`);
}

/** `POST /api/admin/projects` — step 1 of creation. Returns the API key ONCE. */
export function createProject(
  payload: CreateProjectPayload
): Promise<ApiResponse<CreateProjectResponse>> {
  return apiClient.post<CreateProjectResponse>('/admin/projects', payload);
}

/** `PATCH /api/admin/projects/:id` */
export function updateProject(
  id: string,
  payload: UpdateProjectPayload
): Promise<ApiResponse<ProjectDto>> {
  return apiClient.patch<ProjectDto>(`/admin/projects/${id}`, payload);
}

/** `DELETE /api/admin/projects/:id` */
export function deleteProject(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/admin/projects/${id}`);
}

/** `GET /api/admin/projects/:id/api-key` — prefix only, never the full key. */
export function fetchApiKeyInfo(id: string): Promise<ApiResponse<ApiKeyInfoDto>> {
  return apiClient.get<ApiKeyInfoDto>(`/admin/projects/${id}/api-key`);
}

/**
 * `DELETE /api/admin/projects/:id/key` — deactivates the ENTIRE project
 * (blocks all of its API access). Kept separate from `deleteProject`.
 */
export function deactivateProject(id: string): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/admin/projects/${id}/key`);
}

/** `POST /api/admin/projects/:id/restore-key` — reactivates the project. */
export function reactivateProject(id: string): Promise<ApiResponse<null>> {
  return apiClient.post<null>(`/admin/projects/${id}/restore-key`);
}

/** `POST /api/admin/projects/:id/regenerate-api-key` — old key invalidated immediately. */
export function regenerateApiKey(id: string): Promise<ApiResponse<RegenerateApiKeyResponse>> {
  return apiClient.post<RegenerateApiKeyResponse>(`/admin/projects/${id}/regenerate-api-key`);
}

/**
 * `PATCH /api/admin/projects/:id/redirect-uri` — step 2 of creation. Accepts a
 * single URI or a comma-separated list. Returns the full stored string.
 */
export function updateRedirectUri(
  id: string,
  redirectUri: string
): Promise<ApiResponse<{ projectId: string; redirectUri: string }>> {
  return apiClient.patch<{ projectId: string; redirectUri: string }>(
    `/admin/projects/${id}/redirect-uri`,
    { redirectUri }
  );
}

/** `PUT /api/admin/projects/:projectId/servers/:serverId` — grant/update access. */
export function setServerAccess(
  projectId: string,
  serverId: string,
  payload: SetServerAccessPayload
): Promise<ApiResponse<AccessMatrixEntry>> {
  return apiClient.put<AccessMatrixEntry>(
    `/admin/projects/${projectId}/servers/${serverId}`,
    payload
  );
}

/** `DELETE /api/admin/projects/:projectId/servers/:serverId` — revoke access. */
export function revokeServerAccess(
  projectId: string,
  serverId: string
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(`/admin/projects/${projectId}/servers/${serverId}`);
}

/** `GET /api/admin/projects/access/matrix` — full project-server matrix. */
export function fetchAccessMatrix(
  params?: ListAccessMatrixParams
): Promise<ApiResponse<AccessMatrixEntry[]>> {
  return apiClient.get<AccessMatrixEntry[]>(
    `/admin/projects/access/matrix${toSearchString(params)}`
  );
}

/** `GET /api/admin/projects/access/audit` — access grant/update/revoke log. */
export function fetchAccessAudit(
  params?: ListAccessAuditParams
): Promise<ApiResponse<AccessAuditEntry[]>> {
  return apiClient.get<AccessAuditEntry[]>(`/admin/projects/access/audit${toSearchString(params)}`);
}
