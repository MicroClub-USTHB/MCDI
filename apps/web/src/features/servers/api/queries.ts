'use client';

import { useQuery } from '@tanstack/react-query';
import { serverKeys } from '@/features/servers/api/keys';
import { fetchServer, fetchServers } from '@/features/servers/api/service';

export function useServersQuery() {
  return useQuery({
    queryKey: serverKeys.lists(),
    queryFn: async () => {
      const response = await fetchServers();
      return response.data;
    },
  });
}

export function useServerQuery(id: string) {
  return useQuery({
    queryKey: serverKeys.detail(id),
    queryFn: async () => {
      const response = await fetchServer(id);
      return response.data;
    },
    enabled: !!id,
  });
}
