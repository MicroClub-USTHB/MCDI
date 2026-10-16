'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import type { InboundWebhookView } from '@/features/inbound-webhooks/api/mappers';
import { useAllowedRolesQuery } from '@/features/inbound-webhooks/api/queries';
import { DataTable, type DataTableColumn } from '@/shared/components/ui/data-table';
import { McBadge } from '@/shared/components/ui/mc-badge';

function Readers({ webhookId }: { webhookId: string }) {
  const roles = useAllowedRolesQuery(webhookId);
  return (
    <span className="text-muted-foreground">
      {roles.data ? roles.data.map((role) => role.roleName).join(', ') || 'None' : '…'}
    </span>
  );
}

const SUCCESS_BADGE = 'border-success/30 bg-success/10 text-success';
const WARNING_BADGE = 'border-warning/30 bg-warning/10 text-warning';

// Defined once: the table treats a new cell function as a new component and would remount every cell.
const columns: DataTableColumn<InboundWebhookView>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex flex-col">
        <Link
          href={`/dashboard/projects/${encodeURIComponent(row.original.projectId)}/inbound-webhooks/${encodeURIComponent(row.original.id)}`}
          className="rounded-sm font-medium text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.original.name}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{row.original.slug}</span>
      </div>
    ),
  },
  {
    accessorKey: 'signatureLabel',
    header: 'Signature',
    cell: ({ row }) => (
      <McBadge
        variant="outline"
        className={row.original.signatureLabel === 'Signed' ? SUCCESS_BADGE : WARNING_BADGE}
      >
        {row.original.signatureLabel}
      </McBadge>
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
      <span className="font-mono text-xs">{row.original.submissionCount.toLocaleString()}</span>
    ),
  },
  {
    accessorKey: 'lastSubmissionLabel',
    header: 'Last submission',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.lastSubmissionLabel}</span>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => (
      <McBadge variant="outline" className={row.original.isActive ? SUCCESS_BADGE : undefined}>
        {row.original.isActive ? 'Active' : 'Disabled'}
      </McBadge>
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
