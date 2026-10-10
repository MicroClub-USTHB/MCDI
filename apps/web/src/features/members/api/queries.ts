'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { memberKeys } from '@/features/members/api/keys';
import {
  fetchMemberPermissions,
  fetchMemberServers,
  fetchMembers,
  fetchServerRoles,
} from '@/features/members/api/service';
import { mapMemberListResponse, mapMemberServersResponse } from '@/features/members/api/mappers';
import type { MemberFilters } from '@/features/members/types';
import { useCan } from '@/shared/lib/use-access';

export function useMembersQuery(filters: MemberFilters) {
  const allowed = useCan('members', 'read');
  return useQuery({
    queryKey: memberKeys.list(filters),
    queryFn: async () => {
      const response = await fetchMembers(filters);
      return mapMemberListResponse(response.data);
    },
    retry: false,
    placeholderData: (previousData) => previousData,
    enabled: allowed,
  });
}

export function useMemberQuery(discordId: string) {
  const allowed = useCan('members', 'read');
  return useQuery({
    queryKey: memberKeys.detail(discordId),
    queryFn: async () => {
      const response = await fetchMemberServers(discordId);
      return mapMemberServersResponse(response.data);
    },
    enabled: allowed && Boolean(discordId),
    retry: false,
  });
}

export function useMemberServersQuery(discordId: string) {
  const allowed = useCan('members', 'read');
  return useQuery({
    queryKey: memberKeys.servers(discordId),
    queryFn: async () => {
      const response = await fetchMemberServers(discordId);
      return mapMemberServersResponse(response.data);
    },
    enabled: allowed && Boolean(discordId),
    retry: false,
  });
}

export function useMemberPermissionsQueries(discordId: string, serverIds: string[]) {
  const queries = useQueries({
    queries: serverIds.map((serverId) => ({
      queryKey: memberKeys.permissions(serverId, discordId),
      queryFn: async () => {
        const response = await fetchMemberPermissions(serverId, discordId);
        return response.data;
      },
      enabled: Boolean(discordId) && Boolean(serverId),
      retry: false,
    })),
  });

  return useMemo(
    () => ({
      queries,
      isPending: queries.some((query) => query.isPending),
      isError: queries.some((query) => query.isError),
      refetch: async () => {
        await Promise.all(queries.map((query) => query.refetch()));
      },
      data: queries.map((query) => query.data),
    }),
    [queries]
  );
}

export function useServerRolesQuery(serverId: string) {
  const allowed = useCan('stats', 'read');
  return useQuery({
    queryKey: memberKeys.roles(serverId),
    queryFn: async () => {
      const response = await fetchServerRoles(serverId);
      return response.data;
    },
    enabled: allowed && Boolean(serverId),
    retry: false,
  });
}
