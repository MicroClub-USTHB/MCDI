'use client';

import Link from 'next/link';
import { AlertCircle, Inbox, Plus, Settings } from 'lucide-react';

import { useInboundWebhooksQuery } from '@/features/inbound-webhooks/api/queries';
import { WebhookList } from '@/features/inbound-webhooks/components/webhook-list';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useCan } from '@/shared/lib/use-access';

export function InboundWebhooksView({ projectId }: { projectId: string }) {
  const query = useInboundWebhooksQuery(projectId);
  const newHref = `/dashboard/projects/${encodeURIComponent(projectId)}/inbound-webhooks/new`;

  const canCreate = useCan('inbound_webhooks', 'write');
  const newButton = canCreate ? (
    <Button asChild>
      <Link href={newHref}>
        <Plus aria-hidden="true" />
        New inbound webhook
      </Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-hero">Inbound webhooks</h1>
          <p className="mt-1 max-w-2xl text-body text-text-muted">
            Structured data this project sends to MCDI: forms, events, anything a schema can
            describe. Each webhook has a schema, a signing secret and the roles allowed to read what
            it receives.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard/settings/inbound-webhooks">
              <Settings aria-hidden="true" />
              Settings
            </Link>
          </Button>
          {newButton}
        </div>
      </header>

      {query.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load inbound webhooks"
          description="This project’s inbound webhooks could not be retrieved right now."
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      ) : (
        <WebhookList
          webhooks={query.data ?? []}
          isLoading={query.isPending}
          emptyState={
            <EmptyState
              icon={Inbox}
              title="No inbound webhooks"
              description="Create one to start receiving data from outside MCDI, such as a form or a project event."
              action={newButton ?? undefined}
              className="rounded-none border-0"
            />
          }
        />
      )}
    </div>
  );
}
