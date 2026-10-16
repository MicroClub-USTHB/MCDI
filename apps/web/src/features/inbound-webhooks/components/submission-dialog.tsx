'use client';

import { formatDate } from '@/features/inbound-webhooks/api/mappers';
import { useSubmissionQuery } from '@/features/inbound-webhooks/api/queries';
import {
  McDialog,
  McDialogContent,
  McDialogHeader,
  McDialogTitle,
} from '@/shared/components/ui/mc-dialog';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';

interface SubmissionDialogProps {
  webhookId: string;
  submissionId: string | null;
  onClose: () => void;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="paragraph-xs font-semibold tracking-wide text-muted-foreground">{label}</dt>
      <dd className="paragraph-sm break-all text-foreground">{value || '—'}</dd>
    </div>
  );
}

/** One submission in full: where it came from and the whole payload. */
export function SubmissionDialog({ webhookId, submissionId, onClose }: SubmissionDialogProps) {
  const query = useSubmissionQuery(webhookId, submissionId);
  const submission = query.data;

  return (
    <McDialog open={submissionId !== null} onOpenChange={(open) => !open && onClose()}>
      <McDialogContent className="w-[min(42rem,calc(100%-2rem))] sm:min-h-0">
        <McDialogHeader>
          <McDialogTitle>Submission</McDialogTitle>
        </McDialogHeader>
        {query.isError ? (
          <p role="alert" className="paragraph-sm text-error">
            This submission could not be loaded.
          </p>
        ) : !submission ? (
          <McSkeleton rectangle className="h-48 w-full" />
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Received" value={formatDate(submission.receivedAt)} />
              <Detail label="Origin" value={submission.origin} />
              <Detail label="IP address" value={submission.ipAddress} />
              <Detail label="User agent" value={submission.userAgent} />
            </dl>
            <div className="min-h-0">
              <p className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
                Payload
              </p>
              <pre
                aria-label="Payload"
                className="mt-2 max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-foreground"
              >
                {JSON.stringify(submission.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </McDialogContent>
    </McDialog>
  );
}
