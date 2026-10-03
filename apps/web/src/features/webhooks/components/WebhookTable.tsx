'use client';

import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import type { WebhookView } from '@/features/webhooks/api/mappers';
import { DataTable } from '@/shared/components/ui/data-table';
import { cn } from '@/shared/lib/utils';

interface WebhookTableProps {
  webhooks: WebhookView[];
  selectedId: string | null;
  onSelect: (webhookId: string) => void;
  isLoading?: boolean;
  emptyState?: ReactNode;
}

export function WebhookTable({
  webhooks,
  selectedId,
  onSelect,
  isLoading,
  emptyState,
}: WebhookTableProps) {
  const columns: ColumnDef<WebhookView>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const selected = row.original.id === selectedId;
        return (
          <button
            type="button"
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'rounded-sm text-left font-medium text-text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus',
              selected && 'text-brand-light'
            )}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row.original.id);
            }}
          >
            {row.original.name}
          </button>
        );
      },
    },
    { accessorKey: 'channelLabel', header: 'Channel' },
    { accessorKey: 'serverLabel', header: 'Server' },
    {
      accessorKey: 'usageCount',
      header: 'Messages',
      cell: ({ row }) => (
        <span className="font-mono text-code">{row.original.usageCount.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'lastUsedLabel',
      header: 'Last used',
      enableSorting: false,
      cell: ({ row }) => <span className="text-text-muted">{row.original.lastUsedLabel}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={webhooks}
      isLoading={isLoading}
      skeletonRowCount={4}
      emptyState={emptyState}
      onRowClick={(webhook) => onSelect(webhook.id)}
    />
  );
}
