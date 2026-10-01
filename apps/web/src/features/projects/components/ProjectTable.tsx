'use client';

import { useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';

import type { ProjectView } from '@/features/projects/api/mappers';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DataTable } from '@/shared/components/ui/data-table';
import { Pagination } from '@/shared/components/ui/pagination';
import { Switch } from '@/shared/components/ui/switch';

type ProjectAction = 'deactivate' | 'reactivate' | 'delete';

interface ProjectTableProps {
  /** The full filtered dataset — NOT pre-sliced to a page (see DataTable's `pagination` prop). */
  projects: ProjectView[];
  columns?: ColumnDef<ProjectView>[];
  isLoading?: boolean;
  onAction: (action: ProjectAction, project: ProjectView) => void;
  onRowClick?: (project: ProjectView) => void;
  pageIndex: number;
  pageSize: number;
  onPageChange: (index: number) => void;
  emptyState?: React.ReactNode;
}

function buildDefaultColumns(
  onAction: (action: ProjectAction, project: ProjectView) => void
): ColumnDef<ProjectView>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">{row.original.name}</span>
          {row.original.isInternal && <Badge variant="brand-light">Internal</Badge>}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="error">Deactivated</Badge>
        ),
      enableSorting: false,
    },
    {
      accessorKey: 'apiKeyPrefix',
      header: 'API key',
      cell: ({ row }) => (
        <code className="font-mono text-code text-text-muted">
          {row.original.apiKeyPrefix ?? '—'}
        </code>
      ),
    },
    {
      accessorKey: 'lastUsedLabel',
      header: 'Last used',
      cell: ({ row }) => row.original.lastUsedLabel ?? 'Never',
    },
    {
      accessorKey: 'createdAtLabel',
      header: 'Created',
      cell: ({ row }) => row.original.createdAtLabel,
    },
    {
      id: 'active',
      header: 'Activated',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-center" onClick={(event) => event.stopPropagation()}>
          <Switch
            checked={row.original.isActive}
            aria-label={
              row.original.isActive
                ? `Deactivate ${row.original.name}`
                : `Reactivate ${row.original.name}`
            }
            onCheckedChange={() =>
              onAction(row.original.isActive ? 'deactivate' : 'reactivate', row.original)
            }
          />
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-error hover:bg-error/12"
            onClick={() => onAction('delete', row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];
}

function ProjectTable({
  projects,
  columns,
  isLoading = false,
  onAction,
  onRowClick,
  pageIndex,
  pageSize,
  onPageChange,
  emptyState,
}: ProjectTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const resolvedColumns = columns ?? buildDefaultColumns(onAction);
  const pageCount = Math.max(1, Math.ceil(projects.length / pageSize));

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={resolvedColumns}
        data={projects}
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
        totalItems={projects.length}
      />
    </div>
  );
}

export { ProjectTable, type ProjectTableProps, type ProjectAction };
