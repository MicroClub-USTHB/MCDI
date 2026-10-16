import { ChevronLeft, ChevronRight } from 'lucide-react';

import { McButton } from '@/shared/components/ui/mc-button';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';
import { cn } from '@/shared/lib/utils';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

/** Server-side pagination for the member list: range summary, page size and prev/next. */
export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100, 200],
  className,
}: PaginationProps) {
  const safeTotalPages = Math.max(totalPages, 1);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(page * pageSize, total);
  const sizeItems = pageSizeOptions.map((option) => ({
    value: String(option),
    label: String(option),
  }));

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex items-center gap-3 paragraph-sm text-muted-foreground">
        <span>
          Showing {start}-{end} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <span id="members-page-size-label">Per page</span>
          <McSelect
            items={sizeItems}
            value={String(pageSize)}
            onValueChange={(value) => {
              if (value) onPageSizeChange(Number(value));
            }}
          >
            <McSelectTrigger size="sm" className="w-24" aria-labelledby="members-page-size-label">
              <McSelectValue />
            </McSelectTrigger>
            <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
              {sizeItems.map((item) => (
                <McSelectItem key={item.value} value={item.value}>
                  {item.label}
                </McSelectItem>
              ))}
            </McSelectContent>
          </McSelect>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <McButton
          type="button"
          variant="secondary"
          size="sm"
          icon="only"
          iconDefinition={<ChevronLeft aria-hidden="true" />}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous page
        </McButton>
        <span className="min-w-24 text-center paragraph-sm text-muted-foreground">
          Page {page} of {safeTotalPages}
        </span>
        <McButton
          type="button"
          variant="secondary"
          size="sm"
          icon="only"
          iconDefinition={<ChevronRight aria-hidden="true" />}
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          disabled={page >= safeTotalPages}
        >
          Next page
        </McButton>
      </div>
    </div>
  );
}
