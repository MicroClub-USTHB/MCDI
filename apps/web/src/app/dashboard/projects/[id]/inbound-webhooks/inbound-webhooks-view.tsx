'use client';

import Link from 'next/link';
import { AlertCircle, Inbox, Plus, Settings } from 'lucide-react';

import { useInboundWebhooksQuery } from '@/features/inbound-webhooks/api/queries';
import { WebhookList } from '@/features/inbound-webhooks/components/webhook-list';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { buttonVariants } from '@/shared/components/ui/mc-button';
import { useCan } from '@/shared/lib/use-access';

export function InboundWebhooksView({ projectId }: { projectId: string }) {
  const query = useInboundWebhooksQuery(projectId);
  const newHref = `/dashboard/projects/${encodeURIComponent(projectId)}/inbound-webhooks/new`;

  const canCreate = useCan('inbound_webhooks', 'write');
  const newButton = canCreate ? (
    <Link href={newHref} className={buttonVariants({ variant: 'primary', icon: 'leading' })}>
      <Plus aria-hidden="true" className="size-4" />
      New inbound webhook
    </Link>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="header-xs font-bold text-foreground">Inbound webhooks</h1>
          <p className="mt-1 max-w-2xl paragraph-sm text-muted-foreground">
            Structured data this project sends to MCID: forms, events, anything a schema can
            describe. Each webhook has a schema, a signing secret and the roles allowed to read what
            it receives.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/settings/inbound-webhooks"
            className={buttonVariants({ variant: 'secondary', icon: 'leading' })}
          >
            <Settings aria-hidden="true" className="size-4" />
            Settings
          </Link>
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
              description="Create one to start receiving data from outside MCID, such as a form or a project event."
              action={newButton ?? undefined}
              className="rounded-none border-0"
            />
          }
        />
      )}
    </div>
  );
}
