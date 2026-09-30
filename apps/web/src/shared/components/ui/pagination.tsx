import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Button } from './button';

interface PaginationProps {
  pageIndex: number;
  pageCount: number;
  onPageChange: (index: number) => void;
  pageSize: number;
  totalItems: number;
  className?: string;
}

/** Windows page numbers around the current page, e.g. `1 … 4 5 [6] 7 8 … 12`. */
function getPageWindow(pageIndex: number, pageCount: number): (number | 'ellipsis')[] {
  const windowSize = 1;
  const pages = new Set<number>([0, pageCount - 1]);
  for (let i = pageIndex - windowSize; i <= pageIndex + windowSize; i += 1) {
    if (i >= 0 && i < pageCount) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((page, idx) => {
    const prev = sorted[idx - 1];
    if (idx > 0 && prev !== undefined && page - prev > 1) result.push('ellipsis');
    result.push(page);
  });
  return result;
}

function Pagination({
  pageIndex,
  pageCount,
  onPageChange,
  pageSize,
  totalItems,
  className,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const start = pageIndex * pageSize + 1;
  const end = Math.min(totalItems, (pageIndex + 1) * pageSize);

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-between gap-4', className)}
    >
      <p className="text-overline text-text-faint">
        {start}–{end} of {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Previous page"
          disabled={pageIndex === 0}
          onClick={() => onPageChange(pageIndex - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        {getPageWindow(pageIndex, pageCount).map((page, idx) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-text-faint">
              …
            </span>
          ) : (
            <Button
              key={page}
              type="button"
              variant={page === pageIndex ? 'secondary' : 'ghost'}
              size="icon-sm"
              aria-label={`Page ${page + 1}`}
              aria-current={page === pageIndex ? 'page' : undefined}
              onClick={() => onPageChange(page)}
            >
              {page + 1}
            </Button>
          )
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Next page"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

export { Pagination, type PaginationProps };
