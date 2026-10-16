'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useDeleteInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import { useCan } from '@/shared/lib/use-access';
import { showToast } from '@/shared/stores';

/** Deletes the webhook and every submission it holds, after the slug is typed back. */
export function WebhookDeleteSection({ webhook }: { webhook: InboundWebhookDto }) {
  const router = useRouter();
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
        <h2 className="paragraph-sm font-semibold text-error">Delete this webhook</h2>
        <p className="paragraph-sm text-muted-foreground">
          Removes it with {count.toLocaleString()} submission{count === 1 ? '' : 's'}. Callers get a
          404 from then on. This cannot be undone.
        </p>
      </div>
      <McButton
        type="button"
        variant="primary"
        destructive
        className="self-start"
        onClick={() => {
          setTyped('');
          setOpen(true);
        }}
      >
        Delete webhook
      </McButton>

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
        <McInput
          id="delete-confirm"
          label={
            <>
              Type <span className="font-mono text-xs">{webhook.slug}</span> to confirm
            </>
          }
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </ConfirmDialog>
    </section>
  );
}
