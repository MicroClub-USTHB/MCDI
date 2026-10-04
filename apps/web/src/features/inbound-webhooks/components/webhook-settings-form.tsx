'use client';

import { useState } from 'react';

import { parseOrigins } from '@/features/inbound-webhooks/api/mappers';
import { useUpdateInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { useToastStore } from '@/shared/stores/toast';

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** The webhook's name and how it treats requests. Mount it with a key that changes on save so it restarts from the saved values. */
export function WebhookSettingsForm({ webhook }: { webhook: InboundWebhookDto }) {
  const showToast = useToastStore((state) => state.show);
  const update = useUpdateInboundWebhookMutation(webhook.id);

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
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="settings-signature" className="flex flex-col gap-1">
          Require a signature
          <span className="text-text-muted">
            Turning it on rejects callers that don&apos;t sign their requests, from the moment you
            save.
          </span>
        </Label>
        <Switch
          id="settings-signature"
          checked={requireSignature}
          onCheckedChange={setRequireSignature}
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="settings-unknown" className="flex flex-col gap-1">
          Reject unknown fields
          <span className="text-text-muted">
            Off means fields outside the schema are dropped instead.
          </span>
        </Label>
        <Switch
          id="settings-unknown"
          checked={rejectUnknownFields}
          onCheckedChange={setRejectUnknownFields}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="settings-origins">Accepted origins</Label>
        <Textarea
          id="settings-origins"
          value={origins}
          onChange={(event) => setOrigins(event.target.value)}
          placeholder="https://app.microclub.dz"
          rows={3}
        />
        <p className="text-body text-text-muted">
          One per line. Leave empty to accept requests from anywhere.
        </p>
      </div>
      <Button
        type="submit"
        className="self-end"
        disabled={!changed || name.trim() === '' || update.isPending}
      >
        {update.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
