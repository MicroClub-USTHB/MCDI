'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, FolderKanban, Webhook } from 'lucide-react';

import { useProjectsQuery } from '@/features/projects/api/queries';
import { useWebhooksQuery } from '@/features/webhooks/api/queries';
import {
  ProjectContextSelector,
  WebhookDetail,
  WebhookTable,
} from '@/features/webhooks/components';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { LoadingSkeleton } from '@/shared/components/common';

export default function WebhooksPage() {
  const projectsQuery = useProjectsQuery();

  const projects = useMemo(
    () => (projectsQuery.data ?? []).map((project) => ({ id: project.id, name: project.name })),
    [projectsQuery.data]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);

  const activeProjectId = selectedProjectId ?? projects[0]?.id ?? null;

  const webhooksQuery = useWebhooksQuery(activeProjectId);
  const webhooks = webhooksQuery.data?.webhooks ?? [];

  const activeWebhook =
    webhooks.find((webhook) => webhook.id === selectedWebhookId) ?? webhooks[0] ?? null;

  function handleProjectChange(projectId: string) {
    setSelectedProjectId(projectId);
    setSelectedWebhookId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-hero">Webhooks</h1>
          <p className="mt-1 max-w-2xl text-body text-text-muted">
            Review the Discord webhooks each project owns, how much they’re used, and remove the
            ones that shouldn’t exist.
          </p>
        </div>
        <ProjectContextSelector
          projects={projects}
          selected={activeProjectId}
          onChange={handleProjectChange}
          disabled={projectsQuery.isPending}
        />
      </header>

      {projectsQuery.isPending ? (
        <LoadingSkeleton className="h-64 rounded-lg" />
      ) : projectsQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load projects"
          description="The project list could not be retrieved right now. Try again in a moment."
          actionLabel="Retry"
          onAction={() => void projectsQuery.refetch()}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects"
          description="Webhooks belong to projects. Create a project first."
        />
      ) : webhooksQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn’t load webhooks"
          description="This project’s webhooks could not be retrieved right now."
          actionLabel="Retry"
          onAction={() => void webhooksQuery.refetch()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <WebhookTable
            webhooks={webhooks}
            selectedId={activeWebhook?.id ?? null}
            onSelect={setSelectedWebhookId}
            isLoading={webhooksQuery.isPending}
            emptyState={
              <EmptyState
                icon={Webhook}
                title="No webhooks"
                description="Webhooks are created by the project with its own API key. Any it creates will show up here."
                className="rounded-none border-0"
              />
            }
          />

          {activeWebhook ? (
            <WebhookDetail
              key={activeWebhook.id}
              webhook={activeWebhook}
              onDeleted={() => setSelectedWebhookId(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
