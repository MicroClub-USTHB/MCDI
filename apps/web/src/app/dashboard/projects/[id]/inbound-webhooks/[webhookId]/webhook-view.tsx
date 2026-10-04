'use client';

import { AlertCircle, SearchX } from 'lucide-react';

import { useUpdateInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import { useInboundWebhookQuery } from '@/features/inbound-webhooks/api/queries';
import { SubmissionsSection } from '@/features/inbound-webhooks/components/submissions-section';
import { WebhookDocs } from '@/features/inbound-webhooks/components/webhook-docs';
import { WebhookSettingsForm } from '@/features/inbound-webhooks/components/webhook-settings-form';
import { Badge } from '@/shared/components/ui/badge';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useToastStore } from '@/shared/stores/toast';
import type { ApiError } from '@/shared/types';

function ActiveSwitch({ webhookId, isActive }: { webhookId: string; isActive: boolean }) {
  const showToast = useToastStore((state) => state.show);
  const update = useUpdateInboundWebhookMutation(webhookId);

  return (
    <div className="flex items-center gap-3">
      <Badge variant={isActive ? 'success' : 'secondary'}>{isActive ? 'Active' : 'Disabled'}</Badge>
      <Switch
        aria-label="Active"
        checked={isActive}
        disabled={update.isPending}
        onCheckedChange={(next) =>
          update.mutate(
            { isActive: next },
            {
              onSuccess: () => showToast(next ? 'Webhook enabled' : 'Webhook disabled', 'success'),
              onError: (error) =>
                showToast(error.message || 'Failed to update the webhook', 'error'),
            }
          )
        }
      />
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
  if (!query.data) return <Skeleton className="h-64 w-full" />;

  const webhook = query.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-hero break-words">{webhook.name}</h1>
          <p className="mt-1 font-mono text-code text-text-subtle">{webhook.slug}</p>
        </div>
        <ActiveSwitch webhookId={webhook.id} isActive={webhook.isActive} />
      </header>

      {webhook.isActive ? null : (
        <p role="status" className="text-body text-text-muted">
          While it is disabled, every submission is refused with 410 Gone.
        </p>
      )}

      <Tabs defaultValue="submissions" className="flex flex-col gap-4">
        <TabsList aria-label="Webhook sections">
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="docs">Developer docs</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions">
          <SubmissionsSection webhookId={webhook.id} schema={webhook.schema} />
        </TabsContent>
        <TabsContent value="settings">
          <WebhookSettingsForm key={webhook.updatedAt} webhook={webhook} />
        </TabsContent>
        <TabsContent value="docs">
          <WebhookDocs webhookId={webhook.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
