'use client';

import { useState } from 'react';

import { useRotateSecretMutation } from '@/features/inbound-webhooks/api/mutations';
import { SigningSecretDialog } from '@/features/inbound-webhooks/components/signing-secret-dialog';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { useToastStore } from '@/shared/stores/toast';

/** Issues a new signing secret and shows it once. The old one stops working at once. */
export function WebhookSecretSection({ webhookId }: { webhookId: string }) {
  const showToast = useToastStore((state) => state.show);
  const rotate = useRotateSecretMutation(webhookId);
  const [confirming, setConfirming] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

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
        <h2 className="text-subhead text-text-primary">Signing secret</h2>
        <p className="text-body text-text-muted">
          Callers sign every request with it. It is shown only when it is created or rotated.
        </p>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => setConfirming(true)}
      >
        Rotate secret
      </Button>

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
