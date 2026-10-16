'use client';

import * as React from 'react';
import {
  flexRender,
  useTable,
  type OnChangeFn,
  type PaginationState,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';

import { cn } from '@/shared/lib/utils';
import {
  McDataTableColumnHeader,
  McTable,
  McTableBody,
  McTableCell,
  McTableHead,
  McTableHeader,
  McTableRow,
  mcDataTableFeatures,
  type McDataTableColumnDef,
} from '@/shared/components/ui/mc-data-table';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';

/** A column of `DataTable`: a TanStack Table v9 column definition with mcoli-ui column meta. */
type DataTableColumn<TData extends RowData> = McDataTableColumnDef<TData>;

interface DataTableProps<TData extends RowData> {
  columns: DataTableColumn<TData>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  skeletonRowCount?: number;
  emptyState?: React.ReactNode;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /**
   * `data` should be the full (filtered, unsorted-order-agnostic) dataset,
   * not a pre-sliced page: sorting must run before pagination slices it, so
   * this component owns both through TanStack's row model pipeline.
   */
  pagination?: PaginationState;
  className?: string;
  'aria-label'?: string;
}

/**
 * The panel's table: mcoli-ui table primitives and sortable column headers,
 * driven by TanStack Table v9. Rows are clickable when `onRowClick` is set.
 */
function DataTable<TData extends RowData>({
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
  'aria-label': ariaLabel,
}: DataTableProps<TData>) {
  const table = useTable({
    features: mcDataTableFeatures,
    columns,
    data,
    // Without a controlled `pagination` every row shows on one page.
    manualPagination: !pagination,
    state: {
      ...(sorting ? { sorting } : {}),
      ...(pagination ? { pagination } : {}),
    },
    ...(onSortingChange ? { onSortingChange } : {}),
  });

  const columnCount = table.getAllLeafColumns().length;

  return (
    <div
      data-slot="data-table"
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card text-card-foreground',
        className
      )}
    >
      <McTable aria-label={ariaLabel}>
        <McTableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <McTableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <McTableHead
                    key={header.id}
                    scope="col"
                    colSpan={header.colSpan}
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                    }
                    className={cn('px-4', header.column.columnDef.meta?.headerClassName)}
                  >
                    {header.isPlaceholder ? null : <McDataTableColumnHeader header={header} />}
                  </McTableHead>
                );
              })}
            </McTableRow>
          ))}
        </McTableHeader>
        <McTableBody>
          {isLoading ? (
            Array.from({ length: skeletonRowCount }).map((_, rowIdx) => (
              <McTableRow key={`skeleton-${rowIdx}`} className="hover:bg-transparent">
                {Array.from({ length: columnCount }).map((_, colIdx) => (
                  <McTableCell key={`skeleton-cell-${colIdx}`} className="h-auto px-4 py-3">
                    <McSkeleton rectangle className="h-5 w-full max-w-32" />
                  </McTableCell>
                ))}
              </McTableRow>
            ))
          ) : data.length === 0 ? (
            <McTableRow className="hover:bg-transparent">
              <McTableCell colSpan={columnCount} className="h-auto p-0 whitespace-normal">
                {emptyState}
              </McTableCell>
            </McTableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <McTableRow
                key={row.id}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getAllCells().map((cell) => (
                  <McTableCell
                    key={cell.id}
                    className={cn(
                      'h-auto px-4 py-3 text-foreground',
                      cell.column.columnDef.meta?.cellClassName
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </McTableCell>
                ))}
              </McTableRow>
            ))
          )}
        </McTableBody>
      </McTable>
    </div>
  );
}

export { DataTable, type DataTableColumn, type DataTableProps };
