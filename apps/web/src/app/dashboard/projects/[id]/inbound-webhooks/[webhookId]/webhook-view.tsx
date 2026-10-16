'use client';

import { AlertCircle, SearchX } from 'lucide-react';

import { useUpdateInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import { useInboundWebhookQuery } from '@/features/inbound-webhooks/api/queries';
import { SubmissionsSection } from '@/features/inbound-webhooks/components/submissions-section';
import { WebhookDeleteSection } from '@/features/inbound-webhooks/components/webhook-delete-section';
import { WebhookDocs } from '@/features/inbound-webhooks/components/webhook-docs';
import { WebhookReadersSection } from '@/features/inbound-webhooks/components/webhook-readers-section';
import { WebhookSchemaSection } from '@/features/inbound-webhooks/components/webhook-schema-section';
import { WebhookSecretSection } from '@/features/inbound-webhooks/components/webhook-secret-section';
import { WebhookSettingsForm } from '@/features/inbound-webhooks/components/webhook-settings-form';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { McBadge } from '@/shared/components/ui/mc-badge';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';
import { McSwitch } from '@/shared/components/ui/mc-switch';
import { McTabs, McTabsList, McTabsPanel, McTabsTrigger } from '@/shared/components/ui/mc-tabs';
import { useCan } from '@/shared/lib/use-access';
import { showToast } from '@/shared/stores';
import type { ApiError } from '@/shared/types';

function ActiveSwitch({ webhookId, isActive }: { webhookId: string; isActive: boolean }) {
  const update = useUpdateInboundWebhookMutation(webhookId);
  const canWrite = useCan('inbound_webhooks', 'write');

  return (
    <div className="flex items-center gap-3">
      <McBadge
        variant={isActive ? 'outline' : 'secondary'}
        className={isActive ? 'border-success/30 bg-success/10 text-success' : undefined}
      >
        {isActive ? 'Active' : 'Disabled'}
      </McBadge>
      {canWrite && (
        <McSwitch
          aria-label="Active"
          checked={isActive}
          disabled={update.isPending}
          onCheckedChange={(next) =>
            update.mutate(
              { isActive: next },
              {
                onSuccess: () =>
                  showToast(next ? 'Webhook enabled' : 'Webhook disabled', 'success'),
                onError: (error) =>
                  showToast(error.message || 'Failed to update the webhook', 'error'),
              }
            )
          }
        />
      )}
    </div>
  );
}

export function WebhookView({ webhookId }: { webhookId: string }) {
  const query = useInboundWebhookQuery(webhookId);

  if (query.isError) {
    const notFound = (query.error as unknown as ApiError).status === 404;
    return (
      <EmptyState
        icon={notFound ? SearchX : AlertCircle}
        title={notFound ? 'Inbound webhook not found' : 'Couldn’t load this webhook'}
        description={notFound ? 'It may have been deleted.' : undefined}
        actionLabel={notFound ? undefined : 'Retry'}
        onAction={notFound ? undefined : () => void query.refetch()}
      />
    );
  }
  if (!query.data) return <McSkeleton rectangle className="h-64 w-full" />;

  const webhook = query.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="header-xs font-bold break-words text-foreground">{webhook.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{webhook.slug}</p>
        </div>
        <ActiveSwitch webhookId={webhook.id} isActive={webhook.isActive} />
      </header>

      {webhook.isActive ? null : (
        <p role="status" className="paragraph-sm text-muted-foreground">
          While it is disabled, every submission is refused with 410 Gone.
        </p>
      )}

      <McTabs defaultValue="submissions" className="flex flex-col gap-4">
        <McTabsList aria-label="Webhook sections" className="max-w-full overflow-x-auto">
          <McTabsTrigger value="submissions">Submissions</McTabsTrigger>
          <McTabsTrigger value="schema">Schema</McTabsTrigger>
          <McTabsTrigger value="readers">Readers</McTabsTrigger>
          <McTabsTrigger value="settings">Settings</McTabsTrigger>
          <McTabsTrigger value="docs">Developer docs</McTabsTrigger>
        </McTabsList>
        <McTabsPanel value="submissions">
          <SubmissionsSection webhookId={webhook.id} slug={webhook.slug} schema={webhook.schema} />
        </McTabsPanel>
        <McTabsPanel value="schema">
          <WebhookSchemaSection webhook={webhook} />
        </McTabsPanel>
        <McTabsPanel value="readers">
          <WebhookReadersSection webhook={webhook} />
        </McTabsPanel>
        <McTabsPanel value="settings" className="flex flex-col gap-8">
          <WebhookSettingsForm key={webhook.updatedAt} webhook={webhook} />
          <WebhookSecretSection webhookId={webhook.id} />
          <WebhookDeleteSection webhook={webhook} />
        </McTabsPanel>
        <McTabsPanel value="docs">
          <WebhookDocs webhookId={webhook.id} />
        </McTabsPanel>
      </McTabs>
    </div>
  );
}
