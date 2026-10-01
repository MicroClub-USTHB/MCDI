import { apiClient } from '@/shared/lib/api-client';
import { env } from '@/shared/lib/env';
import type { ApiError, ApiResponse } from '@/shared/types';
import { useAuthStore } from '@/features/auth/stores/auth';
import type {
  MemberCrossServerViewDto,
  MemberDetailDto,
  MemberFilters,
  MemberPermissionsDto,
  PaginatedCrossServerListDto,
  ServerRolesResponseDto,
} from '@/features/members/types';

type ExportFormat = 'csv' | 'json';

interface NestErrorBody {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined
) {
  if (value === undefined || value === '') return;
  params.set(key, String(value));
}

function appendQueryParams(params: URLSearchParams, key: string, values: string[]): void {
  values.forEach((value) => {
    if (value.trim()) {
      params.append(key, value.trim());
    }
  });
}

function buildListQueryParams(filters: MemberFilters): string {
  const params = new URLSearchParams();

  appendQueryParam(params, 'filter', filters.filter === 'club' ? 'club' : undefined);
  appendQueryParams(params, 'serverId', filters.serverIds);
  appendQueryParams(params, 'roleId', filters.roleIds);
  appendQueryParam(params, 'search', filters.search?.trim());
  appendQueryParam(params, 'page', filters.page);
  appendQueryParam(params, 'limit', filters.pageSize);

  return params.toString();
}

function buildExportQueryParams(filters: MemberFilters, format: ExportFormat): string {
  const params = new URLSearchParams();

  appendQueryParam(params, 'filter', filters.filter === 'club' ? 'club' : undefined);
  appendQueryParams(params, 'serverId', filters.serverIds);
  appendQueryParams(params, 'roleId', filters.roleIds);
  appendQueryParam(params, 'search', filters.search?.trim());
  appendQueryParam(params, 'format', format);

  return params.toString();
}

function toErrorCode(error: string | undefined, status: number): string {
  if (error) return error.replace(/\s+/g, '_').toUpperCase();
  return status === 401 ? 'UNAUTHORIZED' : 'UNKNOWN_ERROR';
}

function toErrorMessage(message: string | string[] | undefined): string {
  if (Array.isArray(message)) return message.join('; ');
  return message || 'An error occurred';
}

function getDownloadFilename(response: Response, format: ExportFormat): string {
  const contentDisposition = response.headers.get('Content-Disposition');
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
  if (filenameMatch?.[1]) return filenameMatch[1];
  return `members.${format}`;
}

function triggerBlobDownload(blob: Blob, response: Response, format: ExportFormat): void {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = downloadUrl;
  anchor.download = getDownloadFilename(response, format);
  anchor.rel = 'noopener';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
}

async function readErrorResponse(response: Response): Promise<ApiError> {
  const errorData = (await response.json().catch(() => ({}))) as NestErrorBody;
  return {
    message: toErrorMessage(errorData.message),
    code: toErrorCode(errorData.error, response.status),
    status: response.status,
  };
}

export function fetchMembers(
  filters: MemberFilters
): Promise<ApiResponse<PaginatedCrossServerListDto>> {
  const queryString = buildListQueryParams(filters);
  const endpoint = queryString ? `/admin/members?${queryString}` : '/admin/members';

  return apiClient.get<PaginatedCrossServerListDto>(endpoint);
}

export function fetchMember(discordId: string): Promise<ApiResponse<MemberDetailDto>> {
  return apiClient.get<MemberDetailDto>(`/admin/members/${encodeURIComponent(discordId)}`);
}

export function fetchMemberServers(
  discordId: string
): Promise<ApiResponse<MemberCrossServerViewDto>> {
  return apiClient.get<MemberCrossServerViewDto>(
    `/admin/members/${encodeURIComponent(discordId)}/servers`
  );
}

export function fetchServerRoles(serverId: string): Promise<ApiResponse<ServerRolesResponseDto>> {
  return apiClient.get<ServerRolesResponseDto>(
    `/admin/stats/roles?serverId=${encodeURIComponent(serverId)}`
  );
}

export function fetchMemberPermissions(
  serverId: string,
  discordId: string
): Promise<ApiResponse<MemberPermissionsDto>> {
  return fetch(
    `${env.NEXT_PUBLIC_API_URL}/permissions/${encodeURIComponent(serverId)}/${encodeURIComponent(discordId)}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  ).then(async (response) => {
    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    const data = (await response.json()) as MemberPermissionsDto;
    return { data, status: response.status };
  });
}

export async function exportMembers(filters: MemberFilters, format: ExportFormat): Promise<void> {
  const queryString = buildExportQueryParams(filters, format);
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/members/export?${queryString}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) {
    useAuthStore.getState().clearAuth();
  }

  if (!response.ok) {
    throw await readErrorResponse(response);
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, response, format);
}
