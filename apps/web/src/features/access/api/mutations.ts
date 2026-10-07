'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { accessKeys } from '@/features/access/api/keys';
import { setMemberOverrides, setRoleGrants } from '@/features/access/api/service';
import type { MemberOverridesMap, RoleGrantsDto } from '@/features/access/types';
import type { ApiError } from '@/shared/types';

export function useSetRoleGrantsMutation() {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, { roleId: string; grants: RoleGrantsDto }>({
    mutationFn: ({ roleId, grants }) => setRoleGrants(roleId, grants),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accessKeys.roles() }),
  });
}

export function useSetMemberOverridesMutation(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation<unknown, ApiError, MemberOverridesMap>({
    mutationFn: (overrides) => setMemberOverrides(memberId, overrides),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accessKeys.memberOverrides(memberId) }),
        queryClient.invalidateQueries({ queryKey: accessKeys.memberEffective(memberId) }),
        queryClient.invalidateQueries({ queryKey: accessKeys.overridesList() }),
      ]);
    },
  });
}
