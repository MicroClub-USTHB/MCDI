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

interface SigningSecretDialogProps {
  secret: string | null;
  /** What this secret is for, shown under the title. */
  description: string;
  /** Shown beside the secret when the caller needs it too, as after creating a webhook. */
  submitUrl?: string;
  onDone: () => void;
}

/** The signing secret is shown here once; the API never returns it again. */
export function SigningSecretDialog({
  secret,
  description,
  submitUrl,
  onDone,
}: SigningSecretDialogProps) {
  return (
    <Dialog open={secret !== null}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Signing secret</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md bg-warning/12 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-body text-warning">
              This is the only time the secret is shown. Copy it now; if it is lost, rotate it.
            </p>
          </div>
          {secret ? (
            <MaskedInput value={secret} secret aria-label="Signing secret" autoFocus />
          ) : null}
          {submitUrl ? (
            <div>
              <p className="text-overline text-text-subtle">Submit URL</p>
              <MaskedInput value={submitUrl} aria-label="Submit URL" />
            </div>
          ) : null}
          <Button type="button" onClick={onDone} className="self-end">
            I&apos;ve saved the secret
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
