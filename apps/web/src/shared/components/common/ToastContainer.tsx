'use client';

import { useToastStore } from '@/shared/stores/toast';
import { Toast } from '@/shared/components/common/Toast';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  // Each Toast declares its own role="status"/"alert" (which already implies
  // the right aria-live politeness) — nesting a container-level aria-live
  // around them is a documented anti-pattern that causes inconsistent or
  // duplicate announcements. The container itself stays mounted even when
  // empty so the very first toast of a session is reliably announced.
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
