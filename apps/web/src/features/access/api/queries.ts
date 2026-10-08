'use client';

import { useQuery } from '@tanstack/react-query';

import { accessKeys } from '@/features/access/api/keys';
import {
  fetchAccessCatalog,
  fetchAccessRoles,
  fetchMemberEffective,
  fetchMemberOverrides,
  fetchOverridesList,
} from '@/features/access/api/service';
import { ROOT_ONLY } from '@/shared/lib/access';
import { useCanAccess } from '@/shared/lib/use-access';

/** Every hook here is enabled only for root: the API refuses everyone else. */
export function useAccessCatalogQuery() {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.catalog(),
    queryFn: async () => (await fetchAccessCatalog()).data,
    enabled: isRoot,
    staleTime: Infinity,
  });
}

export function useAccessRolesQuery() {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.roles(),
    queryFn: async () => (await fetchAccessRoles()).data,
    enabled: isRoot,
  });
}

export function useMemberOverridesQuery(memberId: string) {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.memberOverrides(memberId),
    queryFn: async () => (await fetchMemberOverrides(memberId)).data,
    enabled: isRoot && memberId.length > 0,
    retry: false,
  });
}

export function useMemberEffectiveQuery(memberId: string) {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.memberEffective(memberId),
    queryFn: async () => (await fetchMemberEffective(memberId)).data,
    enabled: isRoot && memberId.length > 0,
    retry: false,
  });
}

export function useOverridesListQuery() {
  const isRoot = useCanAccess(ROOT_ONLY);
  return useQuery({
    queryKey: accessKeys.overridesList(),
    queryFn: async () => (await fetchOverridesList()).data,
    enabled: isRoot,
  });
}
