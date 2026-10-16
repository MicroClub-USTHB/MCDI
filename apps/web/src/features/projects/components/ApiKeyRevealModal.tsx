'use client';

import { AlertTriangle } from 'lucide-react';

import { McButton } from '@/shared/components/ui/mc-button';
import {
  McDialog,
  McDialogContent,
  McDialogDescription,
  McDialogHeader,
  McDialogTitle,
} from '@/shared/components/ui/mc-dialog';
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
      <div className="flex items-start gap-3 rounded-lg bg-warning/10 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="paragraph-sm text-warning">
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
          <span className="paragraph-xs font-semibold tracking-wide uppercase text-muted-foreground">
            API key
          </span>
        )}
        <MaskedInput value={apiKey} secret aria-label="API key" autoFocus />
      </div>

      {hasWebhook && inboundWebhook && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="paragraph-xs font-semibold tracking-wide uppercase text-muted-foreground">
              Webhook signing secret{' '}
              {inboundWebhook.webhookName ? `(${inboundWebhook.webhookName})` : ''}
            </span>
            <MaskedInput value={inboundWebhook.signingSecret} secret aria-label="Signing secret" />
          </div>
          {inboundWebhook.submitUrl && (
            <div className="flex flex-col gap-1.5">
              <span className="paragraph-xs font-semibold tracking-wide uppercase text-muted-foreground">
                Webhook submit URL
              </span>
              <MaskedInput value={inboundWebhook.submitUrl} aria-label="Submit URL" />
            </div>
          )}
        </>
      )}

      <McButton type="button" onClick={onContinue} className="self-end">
        {confirmLabel === "I've saved the key" ? defaultConfirm : confirmLabel}
      </McButton>
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
    <McDialog open={open} onOpenChange={onOpenChange}>
      <McDialogContent className="sm:min-h-0" showCloseButton={false}>
        <McDialogHeader>
          <McDialogTitle>API key generated</McDialogTitle>
          <McDialogDescription>Copy it now — it won&apos;t be shown again.</McDialogDescription>
        </McDialogHeader>
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
          <p className="paragraph-sm text-muted-foreground">Waiting for the new key…</p>
        )}
      </McDialogContent>
    </McDialog>
  );
}

export { ApiKeyRevealModal, ApiKeyRevealPanel, type ApiKeyRevealModalProps };
