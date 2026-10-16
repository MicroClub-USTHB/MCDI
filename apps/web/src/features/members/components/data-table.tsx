import type { ReactNode } from 'react';

import { LoadingSkeleton } from '@/shared/components/common';
import {
  McTable,
  McTableBody,
  McTableCell,
  McTableHead,
  McTableHeader,
  McTableRow,
} from '@/shared/components/ui/mc-data-table';
import { cn } from '@/shared/lib/utils';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  loadingRows?: number;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Server-paginated table on the mcoli-ui table primitives. Rows are keyboard activatable
 * links when `onRowClick` is set.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading = false,
  loadingRows = 5,
  emptyState,
  onRowClick,
  className,
  ariaLabel,
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <McTable aria-label={ariaLabel}>
        <McTableHeader>
          <McTableRow>
            {columns.map((column) => (
              <McTableHead
                key={column.id}
                scope="col"
                className={cn('px-4', column.headerClassName)}
              >
                {column.header}
              </McTableHead>
            ))}
          </McTableRow>
        </McTableHeader>
        <McTableBody>
          {isLoading ? (
            Array.from({ length: loadingRows }).map((_, rowIndex) => (
              <McTableRow key={`loading-${rowIndex}`}>
                {columns.map((column) => (
                  <McTableCell key={column.id} className={cn('h-auto px-4', column.className)}>
                    <LoadingSkeleton className="h-4 w-full max-w-[12rem]" />
                  </McTableCell>
                ))}
              </McTableRow>
            ))
          ) : data.length > 0 ? (
            data.map((row) => (
              <McTableRow
                key={getRowId(row)}
                className={cn(onRowClick && 'cursor-pointer')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        onRowClick(row);
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? 'link' : undefined}
              >
                {columns.map((column) => (
                  <McTableCell
                    key={column.id}
                    className={cn('h-auto px-4 paragraph-sm text-foreground', column.className)}
                  >
                    {column.cell(row)}
                  </McTableCell>
                ))}
              </McTableRow>
            ))
          ) : (
            <McTableRow className="hover:bg-transparent">
              <McTableCell colSpan={columns.length} className="h-auto px-4 py-10 whitespace-normal">
                {emptyState}
              </McTableCell>
            </McTableRow>
          )}
        </McTableBody>
      </McTable>
    </div>
  );
}
