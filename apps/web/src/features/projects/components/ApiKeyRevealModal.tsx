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

interface ApiKeyRevealPanelProps {
  apiKey: string;
  projectName?: string;
  confirmLabel?: string;
  onContinue: () => void;
}

/** The "copy this key once" body: warning banner + masked copyable key + continue. */
function ApiKeyRevealPanel({
  apiKey,
  projectName,
  confirmLabel = "I've saved the key",
  onContinue,
}: ApiKeyRevealPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md bg-warning/12 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-body text-warning">
          This is the only time <strong>{projectName ? `${projectName}'s` : 'this'}</strong> API key
          will be shown. Save it now — you can only see the prefix afterwards.
        </p>
      </div>
      <MaskedInput value={apiKey} secret aria-label="API key" autoFocus />
      <Button type="button" onClick={onContinue} className="self-end">
        {confirmLabel}
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
}

/** Standalone one-time reveal dialog — used after API key regeneration. */
function ApiKeyRevealModal({
  open,
  onOpenChange,
  apiKey,
  projectName,
  confirmLabel,
  onConfirm,
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
