'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { roleKeys } from '@/features/roles/api/keys';
import {
  addPermissionsToRole,
  createInheritanceRule,
  removePermissionFromRole,
} from '@/features/roles/api/service';
import type { CreateInheritanceRulePayload } from '@/features/roles/types';

export function useAddPermissionsMutation(serverId: string, roleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionIds: number[]) =>
      addPermissionsToRole(serverId, roleId, { permissionIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roleKeys.permissions(serverId, roleId),
      });
      void queryClient.invalidateQueries({
        queryKey: roleKeys.stats(serverId),
      });
    },
  });
}

export function useRemovePermissionMutation(serverId: string, roleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (permissionId: number) => removePermissionFromRole(serverId, roleId, permissionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roleKeys.permissions(serverId, roleId),
      });
      void queryClient.invalidateQueries({
        queryKey: roleKeys.stats(serverId),
      });
    },
  });
}

export function useCreateInheritanceRuleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateInheritanceRulePayload) => createInheritanceRule(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roleKeys.inheritanceList,
      });
    },
  });
}
