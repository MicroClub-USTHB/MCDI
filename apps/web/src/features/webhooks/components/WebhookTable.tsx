'use client';

import type { ReactNode } from 'react';

import type { WebhookView } from '@/features/webhooks/api/mappers';
import { McButton } from '@/shared/components/ui/mc-button';
import { DataTable, type DataTableColumn } from '@/shared/components/ui/data-table';
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
  const columns: DataTableColumn<WebhookView>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => {
        const selected = row.original.id === selectedId;
        return (
          <McButton
            type="button"
            variant="link"
            aria-current={selected ? 'true' : undefined}
            className={cn(
              'text-left font-medium no-underline hover:underline focus-visible:ring-2 focus-visible:ring-ring',
              selected && 'text-primary'
            )}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(row.original.id);
            }}
          >
            {row.original.name}
          </McButton>
        );
      },
    },
    { accessorKey: 'channelLabel', header: 'Channel' },
    { accessorKey: 'serverLabel', header: 'Server' },
    {
      accessorKey: 'usageCount',
      header: 'Messages',
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.usageCount.toLocaleString()}</span>
      ),
    },
    {
      accessorKey: 'lastUsedLabel',
      header: 'Last used',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.lastUsedLabel}</span>
      ),
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
