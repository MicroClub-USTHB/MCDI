'use client';

import { useQuery } from '@tanstack/react-query';
import { serverKeys } from '@/features/servers/api/keys';
import { fetchServer, fetchServers } from '@/features/servers/api/service';
import { useCan } from '@/shared/lib/use-access';

export function useServersQuery() {
  const allowed = useCan('servers', 'read');
  return useQuery({
    queryKey: serverKeys.lists(),
    queryFn: async () => {
      const response = await fetchServers();
      return response.data;
    },
    enabled: allowed,
  });
}

export function useServerQuery(id: string) {
  const allowed = useCan('servers', 'read');
  return useQuery({
    queryKey: serverKeys.detail(id),
    queryFn: async () => {
      const response = await fetchServer(id);
      return response.data;
    },
    enabled: allowed && !!id,
  });
}
