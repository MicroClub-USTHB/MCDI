'use client';

import { McButton } from '@/shared/components/ui/mc-button';
import { Pagination } from '@/shared/components/ui/pagination';
import { LoadingSkeleton } from '@/shared/components/common';
import type { SyncChangeEntry } from '@/features/sync/api/mappers';
import { SyncToneBadge } from './SyncToneBadge';

interface SyncChangeDetailProps {
  changes: SyncChangeEntry[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** 1-based window the current `changes` slice belongs to. */
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/** The granular diff for one selected sync log row — which members/roles/servers changed. */
export function SyncChangeDetail({
  changes,
  isLoading,
  isError,
  onRetry,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: SyncChangeDetailProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="paragraph-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Change details
        </h3>

        {isLoading ? (
          <div className="mt-3 flex flex-col gap-2">
            <LoadingSkeleton className="h-10 rounded-md" />
            <LoadingSkeleton className="h-10 rounded-md" />
            <LoadingSkeleton className="h-10 rounded-md" />
          </div>
        ) : isError ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="paragraph-sm text-error">Couldn’t load the change details.</span>
            {onRetry && (
              <McButton type="button" variant="secondary" size="sm" onClick={onRetry}>
                Retry
              </McButton>
            )}
          </div>
        ) : changes.length === 0 ? (
          <p className="mt-3 paragraph-sm text-muted-foreground">
            No changes were recorded for this sync.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {changes.map((change) => (
              <li key={change.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <SyncToneBadge tone={change.tone}>{change.action.replace(/_/g, ' ')}</SyncToneBadge>
                <div className="min-w-0 flex-1">
                  <p className="paragraph-sm text-foreground">
                    {change.description ?? (
                      <>
                        <span className="text-muted-foreground">{change.entityType}</span>{' '}
                        <span className="font-mono">{change.entityId}</span>
                      </>
                    )}
                  </p>
                  {change.details && (
                    <pre className="mt-1 overflow-x-auto text-xs whitespace-pre-wrap text-muted-foreground">
                      {change.details}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

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
