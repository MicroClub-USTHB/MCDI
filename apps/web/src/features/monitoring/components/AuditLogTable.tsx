import { AlertCircle } from 'lucide-react';

import type { AuditLog } from '@/features/monitoring/types';
import { Badge } from '@/shared/components/ui/badge';
import { DataTable } from '@/shared/components/ui/data-table';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Pagination } from '@/shared/components/ui/pagination';

interface AuditLogTableProps {
  logs: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(timestamp)
  );
}

function AuditLogTable({
  logs,
  total,
  page,
  pageSize,
  isLoading = false,
  onPageChange,
}: AuditLogTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <DataTable
        columns={[
          {
            id: 'timestamp',
            header: 'Timestamp',
            cell: ({ row }) => formatTimestamp(row.original.timestamp),
          },
          {
            id: 'actor',
            header: 'Actor',
            cell: ({ row }) => row.original.actorName ?? row.original.actorId ?? 'System',
          },
          {
            id: 'action',
            header: 'Action',
            cell: ({ row }) => `${row.original.actionType}: ${row.original.action}`,
          },
          {
            id: 'entity',
            header: 'Entity',
            cell: ({ row }) =>
              `${row.original.entityType}${row.original.entityId ? ` (${row.original.entityId})` : ''}`,
          },
          {
            id: 'ip',
            header: 'IP address',
            cell: ({ row }) => row.original.ipAddress ?? 'Unavailable',
          },
          {
            id: 'severity',
            header: 'Severity',
            cell: ({ row }) => (
              <Badge
                variant={row.original.severity === 'info' ? 'secondary' : row.original.severity}
              >
                {row.original.severity}
              </Badge>
            ),
          },
        ]}
        data={logs}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={AlertCircle}
            title="No audit logs found"
            description="Try adjusting the date range or filters."
          />
        }
      />
      <Pagination
        pageIndex={page - 1}
        pageCount={totalPages}
        onPageChange={(nextPageIndex) => onPageChange(nextPageIndex + 1)}
        pageSize={pageSize}
        totalItems={total}
      />
    </div>
  );
}

export { AuditLogTable };
