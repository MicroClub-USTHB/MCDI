'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { logoutAdmin } from '@/features/auth/api/service';
import { useAuthStore } from '@/features/auth/stores/auth';

/**
 * Logs out on both sides: `POST /auth/admin/logout` revokes the session row
 * and clears the `admin_session` httpOnly cookie, then the local store, the
 * `auth-token` cookie the proxy reads, and the React Query cache are
 * dropped here.
 *
 * Local state is cleared in `onSettled` rather than `onSuccess`: if the
 * request fails (offline, already-expired session) the admin's intent was
 * still "log me out", so the client session goes regardless and they land on
 * `/login`. The server-side session may outlive a failed call — but an
 * expired-or-revoked token is exactly the case where the call 401s anyway.
 */
export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: logoutAdmin,
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      router.replace('/login');
    },
  });
}
