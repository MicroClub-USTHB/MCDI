'use client';

import { AlertTriangle } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { MaskedInput } from '@/shared/components/ui/masked-input';

export interface InboundWebhookRevealInfo {
  signingSecret: string;
  submitUrl?: string;
  webhookName?: string;
}

interface ApiKeyRevealPanelProps {
  apiKey: string;
  projectName?: string;
  confirmLabel?: string;
  onContinue: () => void;
  inboundWebhook?: InboundWebhookRevealInfo | null;
}

/** The "copy this key once" body: warning banner + masked copyable key + continue. */
function ApiKeyRevealPanel({
  apiKey,
  projectName,
  confirmLabel = "I've saved the key",
  onContinue,
  inboundWebhook,
}: ApiKeyRevealPanelProps) {
  const hasWebhook = Boolean(inboundWebhook?.signingSecret);
  const defaultConfirm = hasWebhook ? "I've saved both secrets" : "I've saved the key";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md bg-warning/12 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-body text-warning">
          {hasWebhook ? (
            <>
              This is the only time <strong>{projectName ? `${projectName}'s` : 'these'}</strong>{' '}
              credentials (API key and webhook signing secret) will be shown. Save them now — they
              cannot be viewed again.
            </>
          ) : (
            <>
              This is the only time <strong>{projectName ? `${projectName}'s` : 'this'}</strong> API
              key will be shown. Save it now — you can only see the prefix afterwards.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        {hasWebhook && (
          <span className="text-overline font-medium uppercase tracking-wider text-text-subtle">
            API key
          </span>
        )}
        <MaskedInput value={apiKey} secret aria-label="API key" autoFocus />
      </div>

      {hasWebhook && inboundWebhook && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-overline font-medium uppercase tracking-wider text-text-subtle">
              Webhook signing secret{' '}
              {inboundWebhook.webhookName ? `(${inboundWebhook.webhookName})` : ''}
            </span>
            <MaskedInput value={inboundWebhook.signingSecret} secret aria-label="Signing secret" />
          </div>
          {inboundWebhook.submitUrl && (
            <div className="flex flex-col gap-1.5">
              <span className="text-overline font-medium uppercase tracking-wider text-text-subtle">
                Webhook submit URL
              </span>
              <MaskedInput value={inboundWebhook.submitUrl} aria-label="Submit URL" />
            </div>
          )}
        </>
      )}

      <Button type="button" onClick={onContinue} className="self-end">
        {confirmLabel === "I've saved the key" ? defaultConfirm : confirmLabel}
      </Button>
    </div>
  );
}

interface ApiKeyRevealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string | null;
  projectName?: string;
  confirmLabel?: string;
  onConfirm?: () => void;
  inboundWebhook?: InboundWebhookRevealInfo | null;
}

/** Standalone one-time reveal dialog — used after API key regeneration. */
function ApiKeyRevealModal({
  open,
  onOpenChange,
  apiKey,
  projectName,
  confirmLabel,
  onConfirm,
  inboundWebhook,
}: ApiKeyRevealModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>API key generated</DialogTitle>
          <DialogDescription>Copy it now — it won&apos;t be shown again.</DialogDescription>
        </DialogHeader>
        {apiKey ? (
          <ApiKeyRevealPanel
            apiKey={apiKey}
            projectName={projectName}
            confirmLabel={confirmLabel}
            inboundWebhook={inboundWebhook}
            onContinue={() => {
              onConfirm?.();
              onOpenChange(false);
            }}
          />
        ) : (
          <p className="text-body text-text-muted">Waiting for the new key…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { ApiKeyRevealModal, ApiKeyRevealPanel, type ApiKeyRevealModalProps };
