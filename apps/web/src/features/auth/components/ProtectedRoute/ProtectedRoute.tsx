'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/stores/auth';
import { LoadingSkeleton } from '@/shared/components/common';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Client-side complement to `middleware.ts`. The middleware redirects on the
 * server using the `auth-token` presence cookie; this guard covers the gap
 * while Zustand rehydrates from localStorage on first paint, and re-checks
 * in case the client-side session was cleared without a full navigation
 * (e.g. after a `SessionProvider` logout).
 */
export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hasHydrated || isAuthenticated) return;
    router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [hasHydrated, isAuthenticated, pathname, router]);

  if (!hasHydrated || !isAuthenticated) {
    return (
      fallback ?? (
        <div
          role="status"
          aria-label="Checking session"
          className="flex min-h-screen items-center justify-center bg-surface-base"
        >
          <LoadingSkeleton variant="circular" className="h-8 w-8" />
        </div>
      )
    );
  }

  return <>{children}</>;
}
