'use client';

import { useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';

import { Button } from '@/shared/components/ui/button';
import { DataTable } from '@/shared/components/ui/data-table';
import { Pagination } from '@/shared/components/ui/pagination';
import { useCan } from '@/shared/lib/use-access';
import type { ServerListItemDto } from '@/features/servers/types';
import { ServerAvatar } from '@/features/servers/components/ServerAvatar';
import { ServerStatusBadge } from '@/features/servers/components/ServerStatusBadge';
import { ServerTypeBadge } from '@/features/servers/components/ServerTypeBadge';

type ServerAction = 'disable' | 'enable' | 'delete';

interface ServerTableProps {
  /** The full filtered dataset — NOT pre-sliced to a page (see DataTable's `pagination` prop). */
  servers: ServerListItemDto[];
  columns?: ColumnDef<ServerListItemDto>[];
  isLoading?: boolean;
  onAction: (action: ServerAction, server: ServerListItemDto) => void;
  onRowClick?: (server: ServerListItemDto) => void;
  pageIndex: number;
  pageSize: number;
  onPageChange: (index: number) => void;
  emptyState?: React.ReactNode;
}

function formatLastSync(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function buildDefaultColumns(
  onAction: (action: ServerAction, server: ServerListItemDto) => void,
  access: { canWrite: boolean; canManage: boolean }
): ColumnDef<ServerListItemDto>[] {
  const columns: ColumnDef<ServerListItemDto>[] = [
    {
      accessorKey: 'name',
      header: 'Server',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <ServerAvatar name={row.original.name} icon={row.original.icon} size="sm" />
          <span className="font-medium text-text-primary">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <ServerTypeBadge type={row.original.type} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <ServerStatusBadge isActive={row.original.isActive} isMain={row.original.isMain} />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'syncFrequencyHours',
      header: 'Sync Freq.',
      cell: ({ row }) => `${row.original.syncFrequencyHours}h`,
    },
    {
      accessorKey: 'lastSyncAt',
      header: 'Last Sync',
      cell: ({ row }) => formatLastSync(row.original.lastSyncAt),
    },
    {
      accessorKey: 'botConnected',
      header: 'Bot',
      cell: ({ row }) => (
        <span
          className={
            row.original.botConnected
              ? 'inline-block size-1.5 rounded-full bg-success'
              : 'inline-block size-1.5 rounded-full bg-warning'
          }
          aria-label={row.original.botConnected ? 'Bot connected' : 'Bot disconnected'}
        />
      ),
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const server = row.original;
        return (
          <div
            className="flex items-center justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            {access.canWrite ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onAction(server.isActive ? 'disable' : 'enable', server)}
              >
                {server.isActive ? 'Disable' : 'Enable'}
              </Button>
            ) : null}
            {access.canManage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-error hover:bg-error/12"
                onClick={() => onAction('delete', server)}
              >
                Delete
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return columns.filter((column) => column.id !== 'actions' || access.canWrite || access.canManage);
}

function ServerTable({
  servers,
  columns,
  isLoading = false,
  onAction,
  onRowClick,
  pageIndex,
  pageSize,
  onPageChange,
  emptyState,
}: ServerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const canWrite = useCan('servers', 'write');
  const canManage = useCan('servers', 'manage');
  const resolvedColumns = columns ?? buildDefaultColumns(onAction, { canWrite, canManage });
  const pageCount = Math.max(1, Math.ceil(servers.length / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={resolvedColumns}
        data={servers}
        isLoading={isLoading}
        onRowClick={onRowClick}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={{ pageIndex, pageSize }}
        emptyState={emptyState}
      />
      <Pagination
        pageIndex={pageIndex}
        pageCount={pageCount}
        onPageChange={onPageChange}
        pageSize={pageSize}
        totalItems={servers.length}
      />
    </div>
  );
}

export { ServerTable, type ServerTableProps };
