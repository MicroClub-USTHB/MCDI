'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Skeleton } from './skeleton';

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyState?: React.ReactNode;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /**
   * `data` should be the full (filtered, unsorted-order-agnostic) dataset,
   * not a pre-sliced page — sorting must run before pagination slices it, so
   * this component owns both via TanStack's row model pipeline rather than
   * accepting an already-paginated `data` array.
   */
  pagination?: PaginationState;
  className?: string;
}

function DataTable<TData>({
  columns,
  data,
  onRowClick,
  isLoading = false,
  skeletonRowCount = 8,
  emptyState,
  sorting,
  onSortingChange,
  pagination,
  className,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    state: {
      ...(sorting ? { sorting } : {}),
      ...(pagination ? { pagination } : {}),
    },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(pagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  });

  const columnCount = columns.length;

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full border-collapse text-left">
        <thead className="bg-surface-raised">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortable = header.column.getCanSort();
                const sortDirection = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-4 py-3 text-overline text-text-subtle"
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDirection === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : sortDirection === 'desc' ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUpDown className="size-3 text-text-faint" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
              <tr key={`skeleton-${rowIdx}`} className="border-b border-border">
                {Array.from({ length: columnCount }).map((_, colIdx) => (
                  <td key={`skeleton-cell-${colIdx}`} className="px-4 py-3">
                    <Skeleton className="h-5 w-full max-w-32" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="p-0">
                {emptyState}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-border transition-colors last:border-b-0 hover:bg-surface-hover',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-body text-text-normal">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable, type DataTableProps };
