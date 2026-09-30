'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/features/auth/stores/auth';
import { consumePostLoginRedirect, fetchCurrentAdmin } from '@/features/auth/api/service';
import { mapAdminProfileToUser } from '@/features/auth/api/mappers';

type CallbackStatus = 'processing' | 'error' | 'access-denied';

const GENERIC_ERROR_MESSAGE =
  'We could not verify your Discord account. Please try signing in again.';

/**
 * Classify the backend's `?error=` payload.
 *
 * The backend redirects here with the raw exception message — it emits no
 * stable error code — so this matches on the two phrases its role/membership
 * rejections share ("...access the admin panel", "...configured admin role").
 * Server misconfiguration messages deliberately fall through to the generic
 * branch: those are not the admin being denied, and telling them "Access
 * Denied" would send them chasing a Discord role that is not the problem.
 */
function isAccessDenied(errorParam: string): boolean {
  return /admin panel|admin role/i.test(errorParam);
}

/**
 * Runs once on mount. By the time the browser lands here the backend has
 * already completed the Discord exchange and set its `admin_session` httpOnly
 * cookie — nothing about the session is readable from the URL or from JS. So
 * the only way to confirm the login worked is to spend the cookie on a real
 * request: `GET /auth/admin/me`. Success commits the profile to the store and
 * redirects; failure means the cookie is missing, rejected, or belongs to a
 * non-admin. See `features/auth/api/service.ts` for the `getDiscordOAuthUrl`
 * that kicks off this flow.
 */
export function AuthCallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const errorParam = searchParams.get('error');
  // Derived directly from the URL at render time — no effect needed for
  // this branch, only the profile-fetch below has real side effects.
  const [status, setStatus] = useState<CallbackStatus>(() =>
    errorParam ? (isAccessDenied(errorParam) ? 'access-denied' : 'error') : 'processing'
  );
  const [errorMessage, setErrorMessage] = useState(() =>
    errorParam && !isAccessDenied(errorParam) ? errorParam : GENERIC_ERROR_MESSAGE
  );
  const hasRun = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The URL never changes here, so Next.js's route announcer never fires for
  // the processing → error / access-denied transition. Move focus to the
  // outcome heading so screen reader users get an explicit cue the flow
  // finished — pairs with the role="alert" regions below, which announce it
  // even for users who aren't tracking focus.
  useEffect(() => {
    if (status !== 'processing') {
      headingRef.current?.focus();
    }
  }, [status]);

  useEffect(() => {
    if (errorParam || hasRun.current) return;
    hasRun.current = true;

    void (async () => {
      try {
        const response = await fetchCurrentAdmin();
        const user = mapAdminProfileToUser(response.data);
        useAuthStore.getState().setAuth(user, response.data.sessionExpiresAt);
        router.replace(consumePostLoginRedirect());
      } catch (err) {
        useAuthStore.getState().clearAuth();
        // A 403 is the one failure that is specifically "you are signed in to
        // Discord but not allowed in here" — the session cookie was accepted,
        // the admin role check was not.
        const isForbidden =
          typeof err === 'object' && err !== null && (err as { status?: number }).status === 403;
        setStatus(isForbidden ? 'access-denied' : 'error');
        setErrorMessage(GENERIC_ERROR_MESSAGE);
      }
    })();
  }, [errorParam, router]);

  if (status === 'access-denied') {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base p-8 text-center"
      >
        <div className="rounded-full bg-error/12 p-4">
          <ShieldAlert className="h-8 w-8 text-error" aria-hidden="true" />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-hero text-text-primary">
          Access Denied
        </h1>
        <p className="max-w-sm text-body text-text-muted">
          Your Discord account doesn&apos;t have the role required to access the MCDI admin panel.
          Contact a club admin if you believe this is a mistake.
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base p-8 text-center"
      >
        <div className="rounded-full bg-error/12 p-4">
          <AlertTriangle className="h-8 w-8 text-error" aria-hidden="true" />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="text-hero text-text-primary">
          Sign-in failed
        </h1>
        <p className="max-w-sm text-body text-error">{errorMessage}</p>
        <Button asChild variant="secondary" size="sm" className="mt-2">
          <Link href="/login">Retry</Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base"
    >
      <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
      <p className="text-body text-text-muted">Connecting to Discord…</p>
    </div>
  );
}
