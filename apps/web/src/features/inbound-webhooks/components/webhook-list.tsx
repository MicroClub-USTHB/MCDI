'use client';

import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import type { InboundWebhookView } from '@/features/inbound-webhooks/api/mappers';
import { useAllowedRolesQuery } from '@/features/inbound-webhooks/api/queries';
import { Badge } from '@/shared/components/ui/badge';
import { DataTable } from '@/shared/components/ui/data-table';

function Readers({ webhookId }: { webhookId: string }) {
  const roles = useAllowedRolesQuery(webhookId);
  return (
    <span className="text-text-muted">
      {roles.data ? roles.data.map((role) => role.roleName).join(', ') || 'None' : '…'}
    </span>
  );
}

// Defined once: the table treats a new cell function as a new component and would remount every cell.
const columns: ColumnDef<InboundWebhookView>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-text-primary">{row.original.name}</span>
        <span className="font-mono text-code text-text-subtle">{row.original.slug}</span>
      </div>
    ),
  },
  {
    accessorKey: 'signatureLabel',
    header: 'Signature',
    cell: ({ row }) => (
      <Badge variant={row.original.signatureLabel === 'Signed' ? 'success' : 'warning'}>
        {row.original.signatureLabel}
      </Badge>
    ),
  },
  {
    id: 'readers',
    header: 'Readers',
    enableSorting: false,
    cell: ({ row }) => <Readers webhookId={row.original.id} />,
  },
  {
    accessorKey: 'submissionCount',
    header: 'Submissions',
    cell: ({ row }) => (
      <span className="font-mono text-code">{row.original.submissionCount.toLocaleString()}</span>
    ),
  },
  {
    accessorKey: 'lastSubmissionLabel',
    header: 'Last submission',
    enableSorting: false,
    cell: ({ row }) => <span className="text-text-muted">{row.original.lastSubmissionLabel}</span>,
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
        {row.original.isActive ? 'Active' : 'Disabled'}
      </Badge>
    ),
  },
];

interface WebhookListProps {
  webhooks: InboundWebhookView[];
  isLoading: boolean;
  emptyState: ReactNode;
}

export function WebhookList({ webhooks, isLoading, emptyState }: WebhookListProps) {
  return (
    <DataTable
      columns={columns}
      data={webhooks}
      isLoading={isLoading}
      skeletonRowCount={4}
      emptyState={emptyState}
    />
  );
}
