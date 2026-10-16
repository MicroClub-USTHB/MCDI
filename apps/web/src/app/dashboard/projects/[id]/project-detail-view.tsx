'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Trash2 } from 'lucide-react';

import { useApiKeyInfoQuery, useProjectQuery } from '@/features/projects/api/queries';
import {
  useDeleteProjectMutation,
  useReactivateProjectMutation,
  useDeactivateProjectMutation,
  useRegenerateApiKeyMutation,
  useUpdateProjectMutation,
  useUpdateRedirectUriMutation,
} from '@/features/projects/api/mutations';
import { mapApiKeyResponse, mapProjectResponse } from '@/features/projects/api/mappers';
import {
  ApiKeyDisplay,
  ApiKeyRevealModal,
  ApiKeyRotationModal,
  ProjectForm,
  RedirectUriManager,
} from '@/features/projects/components';
import type { ProjectFormValues } from '@/features/projects/types';
import { Can } from '@/shared/components/common';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import {
  McDialog,
  McDialogContent,
  McDialogDescription,
  McDialogHeader,
  McDialogTitle,
} from '@/shared/components/ui/mc-dialog';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';
import { McSwitch } from '@/shared/components/ui/mc-switch';
import { useCan } from '@/shared/lib/use-access';

interface ProjectDetailViewProps {
  id: string;
}

function ProjectDetailView({ id }: ProjectDetailViewProps) {
  const router = useRouter();
  const projectQuery = useProjectQuery(id);
  const apiKeyQuery = useApiKeyInfoQuery(id);

  const updateProjectMutation = useUpdateProjectMutation();
  const updateRedirectMutation = useUpdateRedirectUriMutation();
  const deactivateMutation = useDeactivateProjectMutation();
  const reactivateMutation = useReactivateProjectMutation();
  const deleteMutation = useDeleteProjectMutation();
  const regenerateMutation = useRegenerateApiKeyMutation();

  const canEdit = useCan('projects', 'write');
  const canDelete = useCan('projects', 'manage');
  const canViewKey = useCan('project_keys', 'read');
  const canRotateKey = useCan('project_keys', 'write');
  const canRevokeKey = useCan('project_keys', 'manage');

  const [revealOpen, setRevealOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uris, setUris] = useState<string[]>([]);

  if (projectQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <McSkeleton rectangle className="h-8 w-64" />
        <McSkeleton rectangle className="h-24 w-full" />
        <McSkeleton rectangle className="h-40 w-full" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-6">
        <p className="paragraph-sm text-error">Failed to load this project.</p>
        <McButton
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => {
            void projectQuery.refetch();
            void apiKeyQuery.refetch();
          }}
        >
          Retry
        </McButton>
      </div>
    );
  }

  const project = mapProjectResponse(projectQuery.data);

  function handleAddRedirectUri(uri: string) {
    const next = [...uris, uri];
    setUris(next);
    updateRedirectMutation.mutate({ id, redirectUri: next.join(', ') });
  }

  function handleRemoveRedirectUri(uri: string) {
    const next = uris.filter((item) => item !== uri);
    setUris(next);
    updateRedirectMutation.mutate({ id, redirectUri: next.join(', ') });
  }

  function handleSaveEdit(values: ProjectFormValues) {
    updateProjectMutation.mutate(
      {
        id,
        payload: {
          name: values.name,
          description: values.description,
          isInternal: values.isInternal,
        },
      },
      { onSettled: () => setEditOpen(false) }
    );
  }

  function handleRegenerateConfirm() {
    regenerateMutation.mutate(id, {
      onSuccess: (response) => {
        setRotationOpen(false);
        setNewKey(response.data.apiKey);
      },
    });
  }

  const apiKeyInfo = apiKeyQuery.data ? mapApiKeyResponse(apiKeyQuery.data) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="header-xs font-bold text-foreground">{project.name}</h1>
              {project.isInternal && <McBadge variant="secondary">Internal</McBadge>}
            </div>
            {project.description && (
              <p className="paragraph-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {(project.isActive ? canRevokeKey : canRotateKey) ? (
                <McSwitch
                  checked={project.isActive}
                  aria-label={project.isActive ? 'Deactivate project' : 'Reactivate project'}
                  disabled={deactivateMutation.isPending || reactivateMutation.isPending}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      reactivateMutation.mutate(id);
                    } else {
                      setDeactivateOpen(true);
                    }
                  }}
                />
              ) : null}
              <span className="paragraph-xs font-medium text-muted-foreground">
                {project.isActive ? 'Active' : 'Deactivated'}
              </span>
            </div>
            <Can resource="projects" level="write">
              <McButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </McButton>
            </Can>
          </div>
        </div>
      </div>

      {canViewKey ? (
        <section
          aria-labelledby="api-key-heading"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="api-key-heading" className="paragraph-md font-semibold text-foreground">
              API key
            </h2>
          </div>
          {apiKeyQuery.isPending ? (
            <McSkeleton rectangle className="h-16 w-full" />
          ) : (
            <ApiKeyDisplay
              prefix={apiKeyInfo?.prefix ?? project.apiKeyPrefix}
              isActive={project.isActive}
              canRegenerate={canRotateKey}
              onReveal={() => setRevealOpen(true)}
              onRegenerate={() => setRotationOpen(true)}
            />
          )}
        </section>
      ) : null}

      <section
        aria-labelledby="redirect-heading"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="redirect-heading" className="paragraph-md font-semibold text-foreground">
            Redirect URIs
          </h2>
          <p className="paragraph-xs text-muted-foreground">
            Comma-separated callback URLs used for OAuth. Currently shows what you&apos;ve saved
            this session.
          </p>
        </div>
        <RedirectUriManager
          uris={uris}
          readOnly={!canEdit}
          onAdd={handleAddRedirectUri}
          onRemove={handleRemoveRedirectUri}
          isSubmitting={updateRedirectMutation.isPending}
        />
      </section>

      {canDelete ? (
        <div className="flex justify-end border-t border-border pt-4">
          <McButton
            type="button"
            variant="primary"
            destructive
            size="sm"
            icon="leading"
            iconDefinition={<Trash2 aria-hidden="true" />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete project
          </McButton>
        </div>
      ) : null}

      <McDialog open={revealOpen} onOpenChange={setRevealOpen}>
        <McDialogContent className="sm:min-h-0">
          <McDialogHeader>
            <McDialogTitle>API key details</McDialogTitle>
            <McDialogDescription>
              Only the prefix is stored — the full key was shown once when created.
            </McDialogDescription>
          </McDialogHeader>
          {apiKeyQuery.isPending ? (
            <McSkeleton rectangle className="h-32 w-full" />
          ) : apiKeyInfo ? (
            <dl className="flex flex-col gap-3 paragraph-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Prefix</dt>
                <dd className="font-mono text-xs text-foreground">{apiKeyInfo.prefix ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{apiKeyInfo.createdAtLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Last used</dt>
                <dd>{apiKeyInfo.lastUsedLabel ?? 'Never'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  {apiKeyInfo.isActive ? (
                    <McBadge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success"
                    >
                      Active
                    </McBadge>
                  ) : (
                    <McBadge variant="destructive">Deactivated</McBadge>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="paragraph-sm text-muted-foreground">Failed to load key details.</p>
          )}
        </McDialogContent>
      </McDialog>

      <ApiKeyRotationModal
        open={rotationOpen}
        onOpenChange={setRotationOpen}
        projectName={project.name}
        onConfirm={handleRegenerateConfirm}
        isConfirming={regenerateMutation.isPending}
      />

      <ApiKeyRevealModal
        open={newKey !== null}
        onOpenChange={(open) => {
          if (!open) setNewKey(null);
        }}
        apiKey={newKey}
        projectName={project.name}
        onConfirm={() => setNewKey(null)}
      />

      <McDialog open={editOpen} onOpenChange={setEditOpen}>
        <McDialogContent className="max-h-[90vh] overflow-y-auto sm:w-[min(32rem,calc(100%-2rem))]">
          <McDialogHeader>
            <McDialogTitle>Edit project</McDialogTitle>
            <McDialogDescription>
              Update the project&apos;s name, description, or visibility.
            </McDialogDescription>
          </McDialogHeader>
          <ProjectForm
            mode="edit"
            project={project}
            isSubmitting={updateProjectMutation.isPending}
            onSubmit={handleSaveEdit}
          />
        </McDialogContent>
      </McDialog>

      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate project?"
        description={`Deactivating "${project.name}" blocks ALL of its API access immediately — not just its key. Reactivate it any time.`}
        confirmLabel="Deactivate project"
        onConfirm={() =>
          deactivateMutation.mutate(id, { onSettled: () => setDeactivateOpen(false) })
        }
        isConfirming={deactivateMutation.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title="Delete project?"
        description={`This permanently deletes "${project.name}" and all of its server access. This cannot be undone.`}
        confirmLabel="Delete project"
        onConfirm={() =>
          deleteMutation.mutate(id, {
            onSuccess: () => router.push('/dashboard/projects'),
            onSettled: () => setDeleteOpen(false),
          })
        }
        isConfirming={deleteMutation.isPending}
      />
    </div>
  );
}

export { ProjectDetailView };
