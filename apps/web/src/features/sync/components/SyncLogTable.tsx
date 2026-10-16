'use client';

import { useMemo, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { DataTable } from '@/shared/components/ui/data-table';
import { Pagination } from '@/shared/components/ui/pagination';
import { Badge } from '@/shared/components/ui/badge';
import type { SyncLogEntry } from '@/features/sync/api/mappers';
import { formatAbsoluteTime, formatDuration, formatRelativeTime } from '@/features/sync/lib/format';

interface SyncLogTableProps {
  logs: SyncLogEntry[];
  isLoading?: boolean;
  onSelectLog?: (log: SyncLogEntry) => void;
  /** 1-based window the current `logs` slice belongs to. */
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  emptyState?: ReactNode;
}

export function SyncLogTable({
  logs,
  isLoading = false,
  onSelectLog,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  emptyState,
}: SyncLogTableProps) {
  const columns = useMemo<ColumnDef<SyncLogEntry>[]>(
    () => [
      {
        id: 'startedAt',
        header: 'Started',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="paragraph-sm text-foreground">
              {formatRelativeTime(row.original.startedAt) ?? '—'}
            </span>
            <span className="font-mono paragraph-xs font-semibold tracking-wide text-muted-foreground">
              {formatAbsoluteTime(row.original.startedAt) ?? ''}
            </span>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <span className="paragraph-sm text-muted-foreground capitalize">
            {row.original.syncType}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const { tone, label } = row.original.meta;
          return (
            <div className="flex flex-col gap-1">
              <Badge variant={tone === 'neutral' ? 'secondary' : tone}>{label}</Badge>
              {row.original.status === 'failed' && row.original.message && (
                <span
                  className="max-w-64 truncate paragraph-xs font-semibold tracking-wide text-error"
                  title={row.original.message}
                >
                  {row.original.message}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'synced',
        header: 'Synced',
        cell: ({ row }) => (
          <span className="paragraph-sm text-foreground">
            {row.original.membersSynced.toLocaleString()} members ·{' '}
            {row.original.rolesSynced.toLocaleString()} roles
          </span>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        cell: ({ row }) => (
          <span className="font-mono paragraph-xs font-semibold tracking-wide text-muted-foreground">
            {formatDuration(row.original.durationMs) ?? '—'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        skeletonRowCount={pageSize > 10 ? 10 : pageSize}
        onRowClick={onSelectLog}
        emptyState={emptyState}
      />
      <Pagination
        pageIndex={Math.max(0, page - 1)}
        pageCount={totalPages}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={(index) => onPageChange(index + 1)}
      />
    </div>
  );
}
