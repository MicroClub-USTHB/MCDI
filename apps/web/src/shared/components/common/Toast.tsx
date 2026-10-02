'use client';

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import type { ToastItem } from '@/shared/stores/toast';

const VARIANT_STYLES = {
  success: {
    icon: CheckCircle2,
    container: 'bg-success/12 text-success',
  },
  error: {
    icon: XCircle,
    container: 'bg-error/12 text-error',
  },
  warning: {
    icon: AlertTriangle,
    container: 'bg-warning/12 text-warning',
  },
  info: {
    icon: Info,
    container: 'bg-brand-tint text-brand-light',
  },
} as const;

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

// role="alert" is assertive and interrupts whatever a screen reader is
// currently announcing — appropriate for error/warning, but too disruptive
// for routine success/info confirmations, which use the polite role="status".
const ASSERTIVE_VARIANTS: ReadonlySet<ToastItem['variant']> = new Set(['error', 'warning']);

export function Toast({ toast, onDismiss }: ToastProps) {
  const { icon: Icon, container } = VARIANT_STYLES[toast.variant];
  const role = ASSERTIVE_VARIANTS.has(toast.variant) ? 'alert' : 'status';

  return (
    <div
      role={role}
      className="flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-4 shadow-dropdown"
    >
      <span
        className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', container)}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="flex-1 pt-1 text-body text-text-normal">{toast.message}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="mt-1 shrink-0 text-text-faint hover:text-text-primary"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
