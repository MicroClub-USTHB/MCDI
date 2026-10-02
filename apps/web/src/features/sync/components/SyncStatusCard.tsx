'use client';

import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/components/ui/badge';
import type { SyncServerStatus, SyncTone } from '@/features/sync/api/mappers';
import { formatAbsoluteTime, formatRelativeTime } from '@/features/sync/lib/format';

const dotClass: Record<SyncTone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  neutral: 'bg-text-faint',
};

const badgeVariant: Record<SyncTone, ComponentProps<typeof Badge>['variant']> = {
  success: 'success',
  warning: 'warning',
  error: 'error',
  neutral: 'secondary',
};

interface SyncStatusCardProps {
  serverName: string;
  status: SyncServerStatus;
  /** Rendered in the card footer — typically a per-server `SyncTriggerButton`. */
  action?: ReactNode;
}

export function SyncStatusCard({ serverName, status, action }: SyncStatusCardProps) {
  const { tone, label, isActive } = status.meta;
  const relative = formatRelativeTime(status.lastSyncAt);
  const absolute = formatAbsoluteTime(status.lastSyncAt);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              dotClass[tone],
              isActive && 'animate-pulse'
            )}
            aria-hidden="true"
          />
          <h3 className="text-subhead text-text-primary">{serverName}</h3>
        </div>
        <Badge variant={badgeVariant[tone]}>{label}</Badge>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-body text-text-muted">
          {relative ? `Last sync: ${relative}` : 'Last sync: never'}
        </span>
        {absolute && <span className="font-mono text-overline text-text-subtle">{absolute}</span>}
      </div>

      {status.status === 'success' && (
        <span className="text-body text-text-normal">
          {status.membersSynced.toLocaleString()} members · {status.rolesSynced.toLocaleString()}{' '}
          roles synced
        </span>
      )}

      {status.status === 'failed' && (
        <p className="rounded-md bg-error/12 p-3 text-body text-error">
          {status.message ?? 'Last sync failed.'}
        </p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
