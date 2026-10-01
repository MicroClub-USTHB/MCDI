'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentAdminQuery } from '@/features/auth/api/queries';
import { useAuthStore } from '@/features/auth/stores/auth';
import { useToastStore } from '@/shared/stores/toast';

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * App-wide session watchdog. Revalidates against `GET /auth/admin/me`
 * whenever the store believes it is authenticated; if the request errors
 * (cookie expired, session revoked server-side, admin role removed) it clears
 * local auth state, shows a toast, and returns the admin to `/login`.
 *
 * There is no refresh step to wait on — admin sessions are single 24h tokens
 * with no refresh counterpart — so the first error here is the final answer.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const { data: fresh, isError } = useCurrentAdminQuery();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const showToast = useToastStore((state) => state.show);
  const router = useRouter();
  const hasHandledExpiry = useRef(false);

  useEffect(() => {
    if (!fresh) return;
    setAuth(fresh.user, fresh.sessionExpiresAt);
  }, [fresh, setAuth]);

  useEffect(() => {
    if (!isError || !isAuthenticated || hasHandledExpiry.current) return;
    hasHandledExpiry.current = true;
    clearAuth();
    showToast('Your session has expired. Please log in again.', 'warning');
    router.replace('/login');
  }, [isError, isAuthenticated, clearAuth, showToast, router]);

  return <>{children}</>;
}
