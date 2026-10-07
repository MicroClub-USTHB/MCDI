import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  AccessCatalogDto,
  AccessRoleDto,
  MemberEffectiveDto,
  MemberOverridesDto,
  MemberOverridesMap,
  OverridesListDto,
  RoleGrantsDto,
} from '@/features/access/types';

const BASE = '/admin/access';

export function fetchAccessCatalog(): Promise<ApiResponse<AccessCatalogDto>> {
  return apiClient.get<AccessCatalogDto>(`${BASE}/catalog`);
}

export function fetchAccessRoles(): Promise<ApiResponse<AccessRoleDto[]>> {
  return apiClient.get<AccessRoleDto[]>(`${BASE}/roles`);
}

/** Replaces every grant of the role. A resource left out has no grant. */
export function setRoleGrants(
  roleId: string,
  grants: RoleGrantsDto
): Promise<ApiResponse<{ roleId: string; grants: RoleGrantsDto }>> {
  return apiClient.put(`${BASE}/roles/${encodeURIComponent(roleId)}`, { grants });
}

export function fetchMemberOverrides(memberId: string): Promise<ApiResponse<MemberOverridesDto>> {
  return apiClient.get<MemberOverridesDto>(`${BASE}/members/${encodeURIComponent(memberId)}`);
}

/** Replaces every override of the member. A resource left out is inherited from their roles. */
export function setMemberOverrides(
  memberId: string,
  overrides: MemberOverridesMap
): Promise<ApiResponse<MemberOverridesDto>> {
  return apiClient.put(`${BASE}/members/${encodeURIComponent(memberId)}`, { grants: overrides });
}

export function fetchMemberEffective(memberId: string): Promise<ApiResponse<MemberEffectiveDto>> {
  return apiClient.get<MemberEffectiveDto>(
    `${BASE}/members/${encodeURIComponent(memberId)}/effective`
  );
}

export function fetchOverridesList(): Promise<ApiResponse<OverridesListDto>> {
  return apiClient.get<OverridesListDto>(`${BASE}/overrides`);
}
