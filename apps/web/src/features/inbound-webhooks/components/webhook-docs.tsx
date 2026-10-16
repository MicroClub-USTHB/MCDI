'use client';

import { AlertCircle, Download } from 'lucide-react';

import { docsDownloadUrl } from '@/features/inbound-webhooks/api/service';
import { useWebhookDocsQuery } from '@/features/inbound-webhooks/api/queries';
import { DocsMarkdown } from '@/features/inbound-webhooks/components/docs-markdown';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { buttonVariants } from '@/shared/components/ui/mc-button';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';

/** What the project's developers read to integrate, generated from the live schema. */
export function WebhookDocs({ webhookId }: { webhookId: string }) {
  const docs = useWebhookDocsQuery(webhookId, true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <a
          href={docsDownloadUrl(webhookId, 'markdown')}
          className={buttonVariants({ variant: 'secondary', size: 'sm', icon: 'leading' })}
        >
          <Download aria-hidden="true" className="size-4" />
          Download Markdown
        </a>
        <a
          href={docsDownloadUrl(webhookId, 'openapi')}
          className={buttonVariants({ variant: 'secondary', size: 'sm', icon: 'leading' })}
        >
          <Download aria-hidden="true" className="size-4" />
          Download OpenAPI
        </a>
      </div>
      {docs.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load the docs"
          actionLabel="Retry"
          onAction={() => void docs.refetch()}
        />
      ) : docs.data === undefined ? (
        <McSkeleton rectangle className="h-64 w-full" />
      ) : (
        <div className="rounded-lg border border-border bg-card p-4">
          <DocsMarkdown markdown={docs.data} />
        </div>
      )}
    </div>
  );
}
