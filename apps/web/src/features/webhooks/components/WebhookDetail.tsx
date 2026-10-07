'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

import type { WebhookView } from '@/features/webhooks/api/mappers';
import { useDeleteWebhookMutation } from '@/features/webhooks/api/mutations';
import { WebhookStatsCard } from '@/features/webhooks/components/WebhookStatsCard';
import { Can } from '@/shared/components/common';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { useToastStore } from '@/shared/stores/toast';

interface WebhookDetailProps {
  webhook: WebhookView;
  onDeleted: () => void;
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error;
    if (typeof message === 'string' && message) return message;
  }
  return 'Could not delete the webhook';
}

export function WebhookDetail({ webhook, onDeleted }: WebhookDetailProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteMutation = useDeleteWebhookMutation();
  const showToast = useToastStore((state) => state.show);

  function handleConfirm() {
    deleteMutation.mutate(webhook.id, {
      onSuccess: () => {
        showToast('Webhook deleted', 'success');
        onDeleted();
      },
      onError: (error) => showToast(errorMessage(error), 'error'),
      onSettled: () => setConfirmOpen(false),
    });
  }

  return (
    <section
      aria-labelledby="webhook-detail-heading"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="webhook-detail-heading" className="truncate text-heading text-text-primary">
            {webhook.name}
          </h2>
          <p className="font-mono text-overline text-text-subtle">ID: {webhook.id}</p>
        </div>
        <Can resource="webhooks" level="manage">
          <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete webhook
          </Button>
        </Can>
      </div>

      <WebhookStatsCard usageCount={webhook.usageCount} lastUsed={webhook.lastUsedLabel} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body">
        <dt className="text-text-subtle">Server</dt>
        <dd className="text-text-normal">{webhook.serverLabel}</dd>
        <dt className="text-text-subtle">Channel</dt>
        <dd className="text-text-normal">{webhook.channelLabel}</dd>
        <dt className="text-text-subtle">Created</dt>
        <dd className="text-text-normal">{webhook.createdAtLabel}</dd>
      </dl>

      <p className="text-body text-text-subtle">
        The webhook URL and token are never shown. The project creates, edits and tests its webhooks
        with its own API key.
      </p>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        variant="destructive"
        title="Delete webhook?"
        description={`This deletes "${webhook.name}" on Discord and in MCDI. Anything the project still sends to it will fail. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirm}
        isConfirming={deleteMutation.isPending}
      />
    </section>
  );
}
