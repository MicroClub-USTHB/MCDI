'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { SYNC_CHANGES_PAGE_SIZE, useSyncChangesQuery } from '@/features/sync/api/queries';
import { SyncChangeDetail } from '@/features/sync/components';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';

/** Entity-level changes of one sync run. `backHref` is where "Back to sync" leads. */
export function SyncRunView({ syncLogId: raw, backHref }: { syncLogId: string; backHref: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const syncLogId = Number(raw);
  const isValidId = Number.isInteger(syncLogId) && syncLogId > 0;

  const error = searchParams.get('error');
  const [page, setPage] = useState(1);
  const changesQuery = useSyncChangesQuery(isValidId ? syncLogId : null, page);
  const changes = changesQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="secondary" onClick={() => router.push(backHref)}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sync
        </Button>
      </div>

      {!isValidId ? (
        <EmptyState title="Sync run not found" description="That sync run reference isn’t valid." />
      ) : (
        <>
          <header>
            <h1 className="text-hero">Sync run #{syncLogId}</h1>
            <p className="mt-1 text-body text-text-muted">
              Every entity-level change recorded during this sync operation.
            </p>
          </header>

          {error && (
            <p className="flex items-start gap-2 rounded-md bg-error/12 p-3 text-body text-error">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          )}

          <SyncChangeDetail
            changes={changes?.data ?? []}
            isLoading={changesQuery.isPending}
            isError={changesQuery.isError}
            onRetry={() => void changesQuery.refetch()}
            page={changes?.page ?? page}
            pageSize={changes?.pageSize ?? SYNC_CHANGES_PAGE_SIZE}
            total={changes?.total ?? 0}
            totalPages={changes?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
