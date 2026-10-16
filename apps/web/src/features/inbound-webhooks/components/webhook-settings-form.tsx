'use client';

import { useState } from 'react';

import { parseOrigins } from '@/features/inbound-webhooks/api/mappers';
import { useUpdateInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';
import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import { McSwitch } from '@/shared/components/ui/mc-switch';
import { McTextarea } from '@/shared/components/ui/mc-textarea';
import { useCan } from '@/shared/lib/use-access';
import { showToast } from '@/shared/stores';

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** The webhook's name and how it treats requests. Mount it with a key that changes on save so it restarts from the saved values. */
export function WebhookSettingsForm({ webhook }: { webhook: InboundWebhookDto }) {
  const update = useUpdateInboundWebhookMutation(webhook.id);
  const canWrite = useCan('inbound_webhooks', 'write');

  const [name, setName] = useState(webhook.name);
  const [origins, setOrigins] = useState(webhook.acceptedOrigins.join('\n'));
  const [requireSignature, setRequireSignature] = useState(webhook.requireSignature);
  const [rejectUnknownFields, setRejectUnknownFields] = useState(webhook.rejectUnknownFields);

  const parsedOrigins = parseOrigins(origins);
  const changed =
    name.trim() !== webhook.name ||
    !sameList(parsedOrigins, webhook.acceptedOrigins) ||
    requireSignature !== webhook.requireSignature ||
    rejectUnknownFields !== webhook.rejectUnknownFields;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    update.mutate(
      {
        name: name.trim(),
        acceptedOrigins: parsedOrigins,
        requireSignature,
        rejectUnknownFields,
      },
      {
        onSuccess: () => showToast('Settings saved', 'success'),
        onError: (error) => showToast(error.message || 'Failed to save the settings', 'error'),
      }
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-5">
      <fieldset disabled={!canWrite} className="flex min-w-0 flex-col gap-5 border-0 p-0">
        <McInput
          id="settings-name"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
        />
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="settings-signature"
            className="flex flex-col gap-1 text-sm font-medium text-foreground"
          >
            Require a signature
            <span className="font-normal text-muted-foreground">
              Turning it on rejects callers that don&apos;t sign their requests, from the moment you
              save.
            </span>
          </label>
          <McSwitch
            id="settings-signature"
            checked={requireSignature}
            onCheckedChange={setRequireSignature}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <label
            htmlFor="settings-unknown"
            className="flex flex-col gap-1 text-sm font-medium text-foreground"
          >
            Reject unknown fields
            <span className="font-normal text-muted-foreground">
              Off means fields outside the schema are dropped instead.
            </span>
          </label>
          <McSwitch
            id="settings-unknown"
            checked={rejectUnknownFields}
            onCheckedChange={setRejectUnknownFields}
          />
        </div>
        <McTextarea
          id="settings-origins"
          label="Accepted origins"
          description="One per line. Leave empty to accept requests from anywhere."
          value={origins}
          onChange={(event) => setOrigins(event.target.value)}
          placeholder="https://app.microclub.dz"
          rows={3}
        />
        {canWrite ? (
          <McButton
            type="submit"
            className="self-end"
            disabled={!changed || name.trim() === '' || update.isPending}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </McButton>
        ) : (
          <McBadge variant="secondary" className="self-end">
            Read only
          </McBadge>
        )}
      </fieldset>
    </form>
  );
}
