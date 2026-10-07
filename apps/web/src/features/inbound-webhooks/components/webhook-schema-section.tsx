'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import { useUpdateInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import { PreviewPane } from '@/features/inbound-webhooks/components/preview-pane';
import { useSchemaPreview } from '@/features/inbound-webhooks/components/use-schema-preview';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { useCan } from '@/shared/lib/use-access';
import { useToastStore } from '@/shared/stores/toast';

const SchemaEditor = dynamic(
  () =>
    import('@/features/inbound-webhooks/components/schema-editor').then(
      (module) => module.SchemaEditor
    ),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-md border border-border bg-surface-base" />,
  }
);

/**
 * The webhook's schema: read-only until Edit. A save waits for the API's check of the text as it
 * stands, and with submissions already stored it asks first, since those are not re-checked.
 */
export function WebhookSchemaSection({ webhook }: { webhook: InboundWebhookDto }) {
  const showToast = useToastStore((state) => state.show);
  const update = useUpdateInboundWebhookMutation(webhook.id);
  const canWrite = useCan('inbound_webhooks', 'write');
  const stored = useMemo(() => JSON.stringify(webhook.schema, null, 2), [webhook.schema]);

  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const editing = draft !== null;
  const text = draft ?? stored;

  const { schema, preview, serverProblems, verdict } = useSchemaPreview(text, webhook.name);
  const canSave = editing && text !== stored && verdict === 'ok' && !update.isPending;

  function save() {
    if (!schema) return;
    update.mutate(
      { schema },
      {
        onSuccess: () => {
          setConfirming(false);
          setDraft(null);
          showToast('Schema saved', 'success');
        },
        onError: (error) => {
          setConfirming(false);
          showToast(error.message || 'The schema was refused', 'error');
        },
      }
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-body text-text-muted">
          {editing
            ? 'Changes are checked by the API as you type. New submissions must match the schema you save.'
            : 'What callers may send. Edit it to change the fields.'}
        </p>
        {editing ? (
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSave}
              onClick={() => (webhook.submissionCount > 0 ? setConfirming(true) : save())}
            >
              {update.isPending ? 'Saving…' : 'Save schema'}
            </Button>
          </div>
        ) : canWrite ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(stored)}>
            Edit
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SchemaEditor
          key={editing ? 'edit' : 'read'}
          value={text}
          onChange={setDraft}
          serverProblems={editing ? serverProblems : undefined}
          readOnly={!editing}
        />
        {editing ? (
          <PreviewPane
            preview={preview.data}
            waitingForJson={schema === null}
            isFetching={preview.isFetching}
          />
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Save the new schema?"
        description="Existing submissions are not re-checked; new submissions must match the new schema."
        confirmLabel="Save schema"
        isConfirming={update.isPending}
        onConfirm={save}
      />
    </div>
  );
}
