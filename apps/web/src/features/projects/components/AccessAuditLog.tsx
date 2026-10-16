'use client';

import { ShieldCheck } from 'lucide-react';

import { useAccessAuditQuery } from '@/features/projects/api/queries';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';
import { McBadge } from '@/shared/components/ui/mc-badge';
import type {
  AccessAuditAction,
  AccessAuditEntry,
  AccessOperations,
} from '@/features/projects/types';

interface AccessAuditLogProps {
  projectId: string;
  /** Optional — when omitted, the log fetches via `useAccessAuditQuery`. */
  entries?: AccessAuditEntry[];
  isLoading?: boolean;
}

const ACTION_BADGE: Record<
  AccessAuditAction,
  { variant: 'outline' | 'destructive'; className?: string }
> = {
  GRANT: { variant: 'outline', className: 'border-success/30 bg-success/10 text-success' },
  UPDATE: { variant: 'outline', className: 'border-warning/30 bg-warning/10 text-warning' },
  REVOKE: { variant: 'destructive' },
};

function describeOperations(operations: AccessOperations | null): string {
  if (!operations) return 'no operations';
  const active = Object.entries(operations)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  return active.length > 0 ? active.join(', ') : 'no operations';
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function AccessAuditLog({ projectId, entries, isLoading }: AccessAuditLogProps) {
  const query = useAccessAuditQuery({ projectId });
  const rows = entries ?? query.data;
  const loading = isLoading ?? query.isPending;

  if (loading) {
    return (
      <ul className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index}>
            <McSkeleton rectangle className="h-14 w-full" />
          </li>
        ))}
      </ul>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="size-6" aria-hidden="true" />}
        title="No access changes"
        description="Grants, updates, and revocations for this project will show up here."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <McBadge
              variant={ACTION_BADGE[entry.action].variant}
              className={ACTION_BADGE[entry.action].className}
            >
              {entry.action}
            </McBadge>
            <span className="paragraph-xs text-muted-foreground">
              {formatTime(entry.changedAt)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="paragraph-sm text-foreground">
              Server <code className="font-mono text-xs">{entry.serverId}</code>
            </p>
            <p className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
              by {entry.changedBy} · {describeOperations(entry.operationsBefore)} →{' '}
              {describeOperations(entry.operationsAfter)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export { AccessAuditLog, type AccessAuditLogProps };
