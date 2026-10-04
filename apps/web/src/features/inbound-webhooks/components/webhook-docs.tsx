'use client';

import { AlertCircle, Download } from 'lucide-react';

import { docsDownloadUrl } from '@/features/inbound-webhooks/api/service';
import { useWebhookDocsQuery } from '@/features/inbound-webhooks/api/queries';
import { DocsMarkdown } from '@/features/inbound-webhooks/components/docs-markdown';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';

/** What the project's developers read to integrate, generated from the live schema. */
export function WebhookDocs({ webhookId }: { webhookId: string }) {
  const docs = useWebhookDocsQuery(webhookId, true);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={docsDownloadUrl(webhookId, 'markdown')}>
            <Download aria-hidden="true" />
            Download Markdown
          </a>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <a href={docsDownloadUrl(webhookId, 'openapi')}>
            <Download aria-hidden="true" />
            Download OpenAPI
          </a>
        </Button>
      </div>
      {docs.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load the docs"
          actionLabel="Retry"
          onAction={() => void docs.refetch()}
        />
      ) : docs.data === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-lg border border-border bg-surface-raised p-4">
          <DocsMarkdown markdown={docs.data} />
        </div>
      )}
    </div>
  );
}
