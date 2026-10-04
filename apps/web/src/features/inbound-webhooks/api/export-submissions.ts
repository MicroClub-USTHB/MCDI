import { fetchSubmissions } from '@/features/inbound-webhooks/api/service';
import { schemaColumns, valueAtPath } from '@/features/inbound-webhooks/api/submission-columns';
import type { SubmissionDto } from '@/features/inbound-webhooks/types';

const EXPORT_PAGE_SIZE = 200;

export class ExportCancelled extends Error {
  constructor() {
    super('The export was cancelled');
  }
}

/** One CSV field, quoted when it holds a comma, a quote or a line break (RFC 4180). */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((line) => line.map(csvCell).join(',')).join('\r\n');
}

/**
 * Submissions are untrusted text. A cell that starts with `=`, `+`, `-`, `@` or a tab is run as a
 * formula by spreadsheets, so it gets a leading quote; real numbers are left as they are.
 */
export function exportCellText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return /^[=+\-@\t]/.test(value) ? `'${value}` : value;
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** `id` and `receivedAt`, then one column per answer in schema order. */
export function buildExportRows(schema: Record<string, unknown>, submissions: SubmissionDto[]) {
  const paths = schemaColumns(schema).map((column) => column.path);
  return {
    header: ['id', 'receivedAt', ...paths],
    rows: submissions.map((submission) => [
      submission.id,
      submission.receivedAt,
      ...paths.map((path) => exportCellText(valueAtPath(submission.payload, path))),
    ]),
  };
}

interface ExportOptions {
  webhookId: string;
  schema: Record<string, unknown>;
  filters: { dateFrom?: string; dateTo?: string };
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** Every submission matching the filters, page by page, as one CSV text. */
export async function exportSubmissions({
  webhookId,
  schema,
  filters,
  onProgress,
  signal,
}: ExportOptions): Promise<string> {
  const collected: SubmissionDto[] = [];
  let total = 0;

  do {
    if (signal?.aborted) throw new ExportCancelled();
    const { data } = await fetchSubmissions(webhookId, {
      ...filters,
      limit: EXPORT_PAGE_SIZE,
      offset: collected.length,
    });
    total = data.total;
    collected.push(...data.submissions);
    onProgress?.(collected.length, total);
    if (data.submissions.length === 0) break;
  } while (collected.length < total);

  if (signal?.aborted) throw new ExportCancelled();
  const { header, rows } = buildExportRows(schema, collected);
  return toCsv(header, rows);
}
