import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  AssignPermissionsPayload,
  CreateInheritanceRulePayload,
  ImpactPreviewPayload,
  ImpactPreviewResponse,
  InheritanceRule,
  ListInheritanceRulesParams,
  RolePermissionsResponse,
  RoleStatsResponse,
} from '@/features/roles/types';

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

/** `GET /api/admin/stats/roles?serverId=X` — role distribution for a server. */
export function fetchRoleStats(serverId: string): Promise<ApiResponse<RoleStatsResponse>> {
  return apiClient.get<RoleStatsResponse>(`/admin/stats/roles${toSearchString({ serverId })}`);
}

/** `GET /permissions/admin/servers/:serverId/roles/:roleId/permissions`. */
export function fetchRolePermissions(
  serverId: string,
  roleId: string
): Promise<ApiResponse<RolePermissionsResponse>> {
  return apiClient.get<RolePermissionsResponse>(
    `/permissions/admin/servers/${serverId}/roles/${roleId}/permissions`
  );
}

/** `POST /permissions/admin/servers/:serverId/roles/:roleId/permissions`. */
export function addPermissionsToRole(
  serverId: string,
  roleId: string,
  payload: AssignPermissionsPayload
): Promise<ApiResponse<RolePermissionsResponse>> {
  return apiClient.post<RolePermissionsResponse>(
    `/permissions/admin/servers/${serverId}/roles/${roleId}/permissions`,
    payload
  );
}

/** `DELETE /permissions/admin/servers/:serverId/roles/:roleId/permissions/:permissionId`. */
export function removePermissionFromRole(
  serverId: string,
  roleId: string,
  permissionId: number
): Promise<ApiResponse<null>> {
  return apiClient.delete<null>(
    `/permissions/admin/servers/${serverId}/roles/${roleId}/permissions/${permissionId}`
  );
}

/** `POST /permissions/admin/servers/:serverId/roles/:roleId/impact`. */
export function fetchImpactPreview(
  serverId: string,
  roleId: string,
  payload: ImpactPreviewPayload
): Promise<ApiResponse<ImpactPreviewResponse>> {
  return apiClient.post<ImpactPreviewResponse>(
    `/permissions/admin/servers/${serverId}/roles/${roleId}/impact`,
    payload
  );
}

/** `GET /permissions/inheritance-rules`. */
export function fetchInheritanceRules(
  params?: ListInheritanceRulesParams
): Promise<ApiResponse<InheritanceRule[]>> {
  return apiClient.get<InheritanceRule[]>(
    `/permissions/inheritance-rules${toSearchString(params)}`
  );
}

/** `POST /permissions/inheritance-rules`. */
export function createInheritanceRule(
  payload: CreateInheritanceRulePayload
): Promise<ApiResponse<{ message: string; rule: InheritanceRule }>> {
  return apiClient.post<{ message: string; rule: InheritanceRule }>(
    '/permissions/inheritance-rules',
    payload
  );
}
