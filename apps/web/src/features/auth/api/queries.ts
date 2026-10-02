'use client';

import { useQuery } from '@tanstack/react-query';
import { authKeys } from '@/features/auth/api/keys';
import { fetchCurrentAdmin } from '@/features/auth/api/service';
import { mapAdminProfileToUser } from '@/features/auth/api/mappers';
import { useAuthStore } from '@/features/auth/stores/auth';

/**
 * Validates the current session against the backend. Disabled until the store
 * has hydrated and reports an authenticated session — avoids firing on every
 * anonymous page load. `retry: false` so an expired or rejected session
 * surfaces immediately instead of retrying a doomed request.
 */
export function useCurrentAdminQuery() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const response = await fetchCurrentAdmin();
      return {
        user: mapAdminProfileToUser(response.data),
        sessionExpiresAt: response.data.sessionExpiresAt,
      };
    },
    enabled: hasHydrated && isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
