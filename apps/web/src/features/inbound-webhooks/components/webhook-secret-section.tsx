'use client';

import { useState } from 'react';

import { useRotateSecretMutation } from '@/features/inbound-webhooks/api/mutations';
import { SigningSecretDialog } from '@/features/inbound-webhooks/components/signing-secret-dialog';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { McButton } from '@/shared/components/ui/mc-button';
import { useCan } from '@/shared/lib/use-access';
import { showToast } from '@/shared/stores';

/** Issues a new signing secret and shows it once. The old one stops working at once. */
export function WebhookSecretSection({ webhookId }: { webhookId: string }) {
  const rotate = useRotateSecretMutation(webhookId);
  const [confirming, setConfirming] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const canRotate = useCan('inbound_webhooks', 'write');

  if (!canRotate) return null;

  function confirm() {
    rotate.mutate(undefined, {
      onSuccess: (response) => {
        setConfirming(false);
        setSecret(response.data.signingSecret);
      },
      onError: (error) => {
        setConfirming(false);
        showToast(error.message || 'Failed to rotate the secret', 'error');
      },
    });
  }

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div>
        <h2 className="paragraph-sm font-semibold text-foreground">Signing secret</h2>
        <p className="paragraph-sm text-muted-foreground">
          Callers sign every request with it. It is shown only when it is created or rotated.
        </p>
      </div>
      <McButton
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => setConfirming(true)}
      >
        Rotate secret
      </McButton>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="destructive"
        title="Rotate the signing secret?"
        description="The project must switch to the new secret at once: requests signed with the old one are refused from this moment."
        confirmLabel="Rotate secret"
        isConfirming={rotate.isPending}
        onConfirm={confirm}
      />
      <SigningSecretDialog
        secret={secret}
        description="This is the new secret. The old one no longer works."
        onDone={() => {
          setSecret(null);
          rotate.reset();
        }}
      />
    </section>
  );
}
