'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useDeleteInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Input } from '@/shared/components/ui/input';
import { useCan } from '@/shared/lib/use-access';
import { useToastStore } from '@/shared/stores/toast';

/** Deletes the webhook and every submission it holds, after the slug is typed back. */
export function WebhookDeleteSection({ webhook }: { webhook: InboundWebhookDto }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const remove = useDeleteInboundWebhookMutation(webhook.id, webhook.projectId);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const canDelete = useCan('inbound_webhooks', 'manage');

  if (!canDelete) return null;

  const count = webhook.submissionCount;

  function confirm() {
    remove.mutate(undefined, {
      onSuccess: () => {
        showToast('Webhook deleted', 'success');
        router.push(
          `/dashboard/projects/${encodeURIComponent(webhook.projectId)}/inbound-webhooks`
        );
      },
      onError: (error) => {
        setOpen(false);
        showToast(error.message || 'Failed to delete the webhook', 'error');
      },
    });
  }

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded-lg border border-error/40 p-4">
      <div>
        <h2 className="text-subhead text-error">Delete this webhook</h2>
        <p className="text-body text-text-muted">
          Removes it with {count.toLocaleString()} submission{count === 1 ? '' : 's'}. Callers get a
          404 from then on. This cannot be undone.
        </p>
      </div>
      <Button
        type="button"
        variant="danger"
        className="self-start"
        onClick={() => {
          setTyped('');
          setOpen(true);
        }}
      >
        Delete webhook
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        variant="destructive"
        title="Delete this webhook?"
        description={`This permanently deletes ${webhook.name} and its ${count.toLocaleString()} submission${count === 1 ? '' : 's'}.`}
        confirmLabel="Delete webhook"
        isConfirming={remove.isPending}
        confirmDisabled={typed !== webhook.slug}
        onConfirm={confirm}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="delete-confirm" className="text-body text-text-normal">
            Type <span className="font-mono text-code">{webhook.slug}</span> to confirm
          </label>
          <Input
            id="delete-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </section>
  );
}
