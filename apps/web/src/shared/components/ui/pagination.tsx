import { cn } from '@/shared/lib/utils';
import {
  McPagination,
  McPaginationContent,
  McPaginationEllipsis,
  McPaginationItem,
  McPaginationLink,
  McPaginationNext,
  McPaginationPrevious,
} from '@/shared/components/ui/mc-pagination';

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

/** Range summary plus mcoli-ui pagination controls; renders nothing for a single page. */
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
  const isFirst = pageIndex === 0;
  const isLast = pageIndex >= pageCount - 1;
  const edge = 'pointer-events-none opacity-50';

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <p className="paragraph-xs text-muted-foreground">
        {start}–{end} of {totalItems.toLocaleString()}
      </p>
      <McPagination aria-label="Pagination" className="mx-0 w-auto">
        <McPaginationContent className="gap-1 p-0">
          <McPaginationItem>
            <McPaginationPrevious
              aria-label="Previous page"
              aria-disabled={isFirst || undefined}
              showText={false}
              className={cn(isFirst && edge)}
              onClick={isFirst ? undefined : () => onPageChange(pageIndex - 1)}
            />
          </McPaginationItem>
          {getPageWindow(pageIndex, pageCount).map((page, idx) => (
            <McPaginationItem key={page === 'ellipsis' ? `ellipsis-${idx}` : page}>
              {page === 'ellipsis' ? (
                <McPaginationEllipsis />
              ) : (
                <McPaginationLink
                  aria-label={`Page ${page + 1}`}
                  isActive={page === pageIndex}
                  className="px-3"
                  onClick={() => onPageChange(page)}
                >
                  {page + 1}
                </McPaginationLink>
              )}
            </McPaginationItem>
          ))}
          <McPaginationItem>
            <McPaginationNext
              aria-label="Next page"
              aria-disabled={isLast || undefined}
              showText={false}
              className={cn(isLast && edge)}
              onClick={isLast ? undefined : () => onPageChange(pageIndex + 1)}
            />
          </McPaginationItem>
        </McPaginationContent>
      </McPagination>
    </div>
  );
}

export { Pagination, type PaginationProps };
