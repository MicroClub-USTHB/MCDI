'use client';

import { ShieldCheck } from 'lucide-react';

import { useAccessAuditQuery } from '@/features/projects/api/queries';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Badge } from '@/shared/components/ui/badge';
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

const ACTION_VARIANT: Record<AccessAuditAction, 'success' | 'warning' | 'error'> = {
  GRANT: 'success',
  UPDATE: 'warning',
  REVOKE: 'error',
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
            <Skeleton className="h-14 w-full" />
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
          className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-main p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <Badge variant={ACTION_VARIANT[entry.action]}>{entry.action}</Badge>
            <span className="text-overline text-text-faint">{formatTime(entry.changedAt)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-body text-text-normal">
              Server <code className="font-mono text-code">{entry.serverId}</code>
            </p>
            <p className="text-overline text-text-subtle">
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
