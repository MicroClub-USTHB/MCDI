'use client';

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

/**
 * Catches render errors in any dashboard page, so one broken component shows
 * this panel inside the shell instead of taking the whole app down.
 */
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center"
    >
      <AlertCircle className="size-6 text-error" aria-hidden="true" />
      <h1 className="text-subhead text-text-primary">This page ran into a problem</h1>
      <p className="max-w-md text-body text-text-muted">
        Something on this page failed to display. Try again, or open another section from the
        sidebar.
      </p>
      <Button variant="secondary" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </div>
  );
}
