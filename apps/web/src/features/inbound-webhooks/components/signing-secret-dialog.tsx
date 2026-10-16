'use client';

import { AlertTriangle } from 'lucide-react';

import { MaskedInput } from '@/shared/components/ui/masked-input';
import { McButton } from '@/shared/components/ui/mc-button';
import {
  McDialog,
  McDialogContent,
  McDialogDescription,
  McDialogHeader,
  McDialogTitle,
} from '@/shared/components/ui/mc-dialog';

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
    // Controlled with no onOpenChange: Escape and outside clicks cannot close it, only the button.
    <McDialog open={secret !== null} disablePointerDismissal>
      <McDialogContent className="sm:min-h-0 sm:max-w-md" showCloseButton={false}>
        <McDialogHeader>
          <McDialogTitle>Signing secret</McDialogTitle>
          <McDialogDescription>{description}</McDialogDescription>
        </McDialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md bg-warning/12 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="paragraph-sm text-warning">
              This is the only time the secret is shown. Copy it now; if it is lost, rotate it.
            </p>
          </div>
          {secret ? (
            <MaskedInput value={secret} secret aria-label="Signing secret" autoFocus />
          ) : null}
          {submitUrl ? (
            <div>
              <p className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
                Submit URL
              </p>
              <MaskedInput value={submitUrl} aria-label="Submit URL" />
            </div>
          ) : null}
          <McButton type="button" onClick={onDone} className="self-end">
            I&apos;ve saved the secret
          </McButton>
        </div>
      </McDialogContent>
    </McDialog>
  );
}
