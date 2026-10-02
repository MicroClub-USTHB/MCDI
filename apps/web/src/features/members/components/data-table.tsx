import type { ReactNode } from 'react';

import { LoadingSkeleton } from '@/shared/components/common';
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
  const interactive = Boolean(onRowClick);
  const handleRowClick = onRowClick;

  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-border bg-surface-raised', className)}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse" aria-label={ariaLabel}>
          <thead className="bg-surface-raised">
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left text-overline uppercase tracking-[0.08em] text-text-subtle',
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr key={`loading-${rowIndex}`} className="bg-surface-raised">
                  {columns.map((column) => (
                    <td key={column.id} className={cn('px-4 py-4', column.className)}>
                      <LoadingSkeleton className="h-4 w-full max-w-[12rem]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length > 0 ? (
              data.map((row) => (
                <tr
                  key={getRowId(row)}
                  className={cn(
                    'bg-surface-raised transition-colors',
                    interactive && 'cursor-pointer hover:bg-surface-hover'
                  )}
                  onClick={interactive && handleRowClick ? () => handleRowClick(row) : undefined}
                  onKeyDown={
                    interactive && handleRowClick
                      ? (event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return;
                          event.preventDefault();
                          handleRowClick(row);
                        }
                      : undefined
                  }
                  tabIndex={interactive ? 0 : undefined}
                  role={interactive ? 'link' : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn('px-4 py-4 text-body text-text-normal', column.className)}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10">
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
