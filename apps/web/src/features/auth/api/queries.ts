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
 * surfaces immediately instead of retrying a doomed request. It also carries the
 * member's effective access, so it is revalidated every minute and on window focus.
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
    // A grant or revoke by a root admin reaches an open panel within a minute, or at once
    // when the API refuses a call (see `setForbiddenHandler`).
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}
