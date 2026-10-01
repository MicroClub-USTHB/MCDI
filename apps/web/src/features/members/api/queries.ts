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

export function useMembersQuery(filters: MemberFilters) {
  return useQuery({
    queryKey: memberKeys.list(filters),
    queryFn: async () => {
      const response = await fetchMembers(filters);
      return mapMemberListResponse(response.data);
    },
    retry: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useMemberQuery(discordId: string) {
  return useQuery({
    queryKey: memberKeys.detail(discordId),
    queryFn: async () => {
      const response = await fetchMemberServers(discordId);
      return mapMemberServersResponse(response.data);
    },
    enabled: Boolean(discordId),
    retry: false,
  });
}

export function useMemberServersQuery(discordId: string) {
  return useQuery({
    queryKey: memberKeys.servers(discordId),
    queryFn: async () => {
      const response = await fetchMemberServers(discordId);
      return mapMemberServersResponse(response.data);
    },
    enabled: Boolean(discordId),
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
  return useQuery({
    queryKey: memberKeys.roles(serverId),
    queryFn: async () => {
      const response = await fetchServerRoles(serverId);
      return response.data;
    },
    enabled: Boolean(serverId),
    retry: false,
  });
}
