'use client';

import { formatDate } from '@/features/inbound-webhooks/api/mappers';
import { useSubmissionQuery } from '@/features/inbound-webhooks/api/queries';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';

interface SubmissionDialogProps {
  webhookId: string;
  submissionId: string | null;
  onClose: () => void;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-overline text-text-subtle">{label}</dt>
      <dd className="text-body break-all text-text-normal">{value || '—'}</dd>
    </div>
  );
}

/** One submission in full: where it came from and the whole payload. */
export function SubmissionDialog({ webhookId, submissionId, onClose }: SubmissionDialogProps) {
  const query = useSubmissionQuery(webhookId, submissionId);
  const submission = query.data;

  return (
    <Dialog open={submissionId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submission</DialogTitle>
        </DialogHeader>
        {query.isError ? (
          <p role="alert" className="text-body text-error">
            This submission could not be loaded.
          </p>
        ) : !submission ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="flex min-h-0 flex-col gap-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Received" value={formatDate(submission.receivedAt)} />
              <Detail label="Origin" value={submission.origin} />
              <Detail label="IP address" value={submission.ipAddress} />
              <Detail label="User agent" value={submission.userAgent} />
            </dl>
            <div className="min-h-0">
              <p className="text-overline text-text-subtle">Payload</p>
              <pre
                aria-label="Payload"
                className="mt-2 max-h-80 overflow-auto rounded-md bg-surface-base p-3 font-mono text-code text-text-normal"
              >
                {JSON.stringify(submission.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
