import { AlertCircle } from 'lucide-react';

import type { AuthFailure } from '@/features/monitoring/types';
import { DataTable } from '@/shared/components/ui/data-table';
import { EmptyState } from '@/shared/components/ui/empty-state';

interface AuthFailureTableProps {
  failures: AuthFailure[];
  isLoading?: boolean;
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(timestamp)
  );
}

function AuthFailureTable({ failures, isLoading = false }: AuthFailureTableProps) {
  return (
    <DataTable
      columns={[
        {
          id: 'timestamp',
          header: 'Timestamp',
          cell: ({ row }) => formatTimestamp(row.original.timestamp),
        },
        {
          id: 'ip',
          header: 'IP address',
          cell: ({ row }) => row.original.ipAddress ?? 'Unavailable',
        },
        {
          id: 'actor',
          header: 'Attempted actor',
          cell: ({ row }) => row.original.attemptedActor ?? 'Unknown',
        },
        {
          id: 'reason',
          header: 'Reason',
          cell: ({ row }) => row.original.reason ?? 'Unknown reason',
        },
        {
          id: 'path',
          header: 'Path',
          cell: ({ row }) => row.original.path ?? 'OAuth callback',
        },
      ]}
      data={failures}
      isLoading={isLoading}
      emptyState={
        <EmptyState
          icon={AlertCircle}
          title="No recent authentication failures"
          description="Failed admin logins and rejected credentials will appear here."
        />
      }
    />
  );
}

export { AuthFailureTable };
