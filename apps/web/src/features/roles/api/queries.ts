'use client';

import { useCallback } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { roleKeys } from '@/features/roles/api/keys';
import {
  fetchImpactPreview,
  fetchInheritanceRules,
  fetchRolePermissions,
  fetchRoleStats,
} from '@/features/roles/api/service';
import type { ImpactPreviewPayload, ListInheritanceRulesParams } from '@/features/roles/types';
import { useCan } from '@/shared/lib/use-access';

export function useRoleStatsQuery(serverId: string) {
  const allowed = useCan('stats', 'read');
  return useQuery({
    queryKey: roleKeys.stats(serverId),
    queryFn: async () => {
      const response = await fetchRoleStats(serverId);
      return response.data;
    },
    enabled: allowed && serverId.length > 0,
  });
}

export function useRolePermissionsQuery(serverId: string, roleId: string) {
  const allowed = useCan('roles', 'read');
  return useQuery({
    queryKey: roleKeys.permissions(serverId, roleId),
    queryFn: async () => {
      const response = await fetchRolePermissions(serverId, roleId);
      return response.data;
    },
    enabled: allowed && serverId.length > 0 && roleId.length > 0,
  });
}

export function useImpactPreviewQuery(
  serverId: string,
  roleId: string,
  payload: ImpactPreviewPayload
) {
  const allowed = useCan('roles', 'read');
  return useQuery({
    queryKey: roleKeys.impact(serverId, roleId, payload),
    queryFn: async () => {
      const response = await fetchImpactPreview(serverId, roleId, payload);
      return response.data;
    },
    enabled:
      allowed && serverId.length > 0 && roleId.length > 0 && payload.permissionIds.length > 0,
  });
}

export function useInheritanceRulesQuery(params?: ListInheritanceRulesParams) {
  const allowed = useCan('roles', 'read');
  return useQuery({
    queryKey: roleKeys.inheritance(params),
    queryFn: async () => {
      const response = await fetchInheritanceRules(params);
      return response.data;
    },
    enabled: allowed && params?.serverId != null,
  });
}

export function useAllRolePermissionsQuery(serverId: string, roleIds: string[]) {
  const allowed = useCan('roles', 'read');
  const combine = useCallback(
    (
      results: Array<{ data?: { roleId: string; count: number } | undefined; isLoading: boolean }>
    ) => {
      const map = new Map<string, number>();
      for (const r of results) {
        if (r.data) map.set(r.data.roleId, r.data.count);
      }
      return {
        permissionCounts: map,
        isLoading: results.some((r) => r.isLoading),
      };
    },
    []
  );

  return useQueries({
    queries: roleIds.map((roleId) => ({
      queryKey: roleKeys.permissions(serverId, roleId),
      queryFn: async () => {
        const response = await fetchRolePermissions(serverId, roleId);
        return response.data;
      },
      enabled: allowed && serverId.length > 0 && roleIds.length > 0,
      select: (data: Awaited<ReturnType<typeof fetchRolePermissions>>['data']) => ({
        roleId,
        count: data.permissions.length,
      }),
    })),
    combine,
  });
}
