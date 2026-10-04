'use client';

import { useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, Download, Inbox, X } from 'lucide-react';

import {
  ExportCancelled,
  exportSubmissions,
} from '@/features/inbound-webhooks/api/export-submissions';
import { formatDate } from '@/features/inbound-webhooks/api/mappers';
import { useSubmissionsQuery } from '@/features/inbound-webhooks/api/queries';
import {
  cellText,
  defaultColumnPaths,
  schemaColumns,
  valueAtPath,
} from '@/features/inbound-webhooks/api/submission-columns';
import { ColumnsMenu } from '@/features/inbound-webhooks/components/columns-menu';
import { SubmissionDialog } from '@/features/inbound-webhooks/components/submission-dialog';
import type { SubmissionDto } from '@/features/inbound-webhooks/types';
import { Button } from '@/shared/components/ui/button';
import { DataTable } from '@/shared/components/ui/data-table';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Pagination } from '@/shared/components/ui/pagination';
import { downloadTextFile } from '@/shared/lib/download';
import { useToastStore } from '@/shared/stores/toast';
import type { ApiError } from '@/shared/types';

const PAGE_SIZE = 50;

function storageKey(webhookId: string) {
  return `inbound-webhook-columns:${webhookId}`;
}

function readStored(webhookId: string): string[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(webhookId)) ?? 'null');
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? (value as string[])
      : null;
  } catch {
    return null;
  }
}

function writeStored(webhookId: string, paths: string[]) {
  try {
    localStorage.setItem(storageKey(webhookId), JSON.stringify(paths));
  } catch {
    // Storage can be blocked; the choice then lasts until the page is closed.
  }
}

const statusOf = (error: unknown): number | null =>
  typeof error === 'object' && error !== null && 'status' in error
    ? (error as ApiError).status
    : null;

interface SubmissionsSectionProps {
  webhookId: string;
  slug: string;
  schema: Record<string, unknown>;
}

/** What the webhook has received, as the role-gated read API returns it. */
export function SubmissionsSection({ webhookId, slug, schema }: SubmissionsSectionProps) {
  const showToast = useToastStore((state) => state.show);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const exportController = useRef<AbortController | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [stored, setStored] = useState<string[] | null>(() => readStored(webhookId));

  const available = useMemo(() => schemaColumns(schema), [schema]);
  const fallback = useMemo(() => defaultColumnPaths(schema), [schema]);
  const selected = useMemo(() => {
    const known = new Set(available.map((column) => column.path));
    const kept = (stored ?? []).filter((path) => known.has(path));
    return stored === null ? fallback : kept;
  }, [stored, available, fallback]);

  const query = useSubmissionsQuery(webhookId, {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  });

  const columns = useMemo<ColumnDef<SubmissionDto>[]>(
    () => [
      {
        id: 'receivedAt',
        header: 'Received',
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setOpenId(row.original.id)}
            className="rounded-sm text-left text-text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {formatDate(row.original.receivedAt) ?? row.original.receivedAt}
          </button>
        ),
      },
      ...selected.map<ColumnDef<SubmissionDto>>((path) => ({
        id: path,
        header: path,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-code">
            {cellText(valueAtPath(row.original.payload, path))}
          </span>
        ),
      })),
    ],
    [selected]
  );

  function changeDate(setter: (value: string) => void, value: string) {
    setter(value);
    setPageIndex(0);
  }

  function chooseColumns(paths: string[]) {
    setStored(paths);
    writeStored(webhookId, paths);
  }

  async function exportCsv() {
    const controller = new AbortController();
    exportController.current = controller;
    setExportProgress({ done: 0, total: query.data?.total ?? 0 });
    try {
      const csv = await exportSubmissions({
        webhookId,
        schema,
        filters: { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
        signal: controller.signal,
        onProgress: (done, total) => setExportProgress({ done, total }),
      });
      const today = new Date().toISOString().slice(0, 10);
      downloadTextFile(`${slug}-submissions-${today}.csv`, csv, 'text/csv');
      showToast('Export ready', 'success');
    } catch (error) {
      if (!(error instanceof ExportCancelled)) {
        showToast((error as Partial<ApiError>).message || 'The export failed', 'error');
      }
    } finally {
      exportController.current = null;
      setExportProgress(null);
    }
  }

  const filtered = dateFrom !== '' || dateTo !== '';
  const total = query.data?.total ?? 0;
  const status = statusOf(query.error);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="submissions-from">From (UTC)</Label>
            <Input
              id="submissions-from"
              type="date"
              value={dateFrom}
              onChange={(event) => changeDate(setDateFrom, event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="submissions-to">To (UTC)</Label>
            <Input
              id="submissions-to"
              type="date"
              value={dateTo}
              onChange={(event) => changeDate(setDateTo, event.target.value)}
            />
          </div>
          {filtered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setPageIndex(0);
              }}
            >
              <X aria-hidden="true" />
              Clear dates
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exportProgress ? (
            <>
              <span role="status" className="text-body text-text-muted">
                Exporting {exportProgress.done.toLocaleString()} of{' '}
                {exportProgress.total.toLocaleString()}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => exportController.current?.abort()}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={total === 0}
              onClick={() => void exportCsv()}
            >
              <Download aria-hidden="true" />
              Export CSV
            </Button>
          )}
          <ColumnsMenu
            available={available}
            selected={selected}
            onChange={chooseColumns}
            onReset={() => {
              setStored(null);
              try {
                localStorage.removeItem(storageKey(webhookId));
              } catch {
                // Nothing stored to forget.
              }
            }}
          />
        </div>
      </div>

      {query.isError ? (
        <EmptyState
          icon={AlertCircle}
          title={
            status === 404
              ? "You don't hold a role that can read this webhook's submissions"
              : 'Couldn’t load the submissions'
          }
          description={
            status === 404
              ? 'Ask an administrator to grant one of this webhook’s reader roles to your account.'
              : undefined
          }
          actionLabel={status === 404 ? undefined : 'Retry'}
          onAction={status === 404 ? undefined : () => void query.refetch()}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={query.data?.submissions ?? []}
            isLoading={query.isPending}
            skeletonRowCount={5}
            emptyState={
              <EmptyState
                icon={Inbox}
                title={filtered ? 'No submissions in this period' : 'No submissions yet'}
                description={
                  filtered
                    ? 'Widen or clear the dates to see more.'
                    : 'They appear here as soon as the project sends one.'
                }
                className="rounded-none border-0"
              />
            }
          />
          <Pagination
            pageIndex={pageIndex}
            pageCount={Math.ceil(total / PAGE_SIZE)}
            onPageChange={setPageIndex}
            pageSize={PAGE_SIZE}
            totalItems={total}
          />
        </>
      )}

      <SubmissionDialog
        webhookId={webhookId}
        submissionId={openId}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
