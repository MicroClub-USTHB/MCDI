'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Trash2 } from 'lucide-react';

import {
  useApiKeyInfoQuery,
  useAccessMatrixQuery,
  useProjectQuery,
} from '@/features/projects/api/queries';
import {
  useDeleteProjectMutation,
  useReactivateProjectMutation,
  useDeactivateProjectMutation,
  useRegenerateApiKeyMutation,
  useSetServerAccessMutation,
  useRevokeServerAccessMutation,
  useUpdateProjectMutation,
  useUpdateRedirectUriMutation,
} from '@/features/projects/api/mutations';
import { mapApiKeyResponse, mapProjectResponse } from '@/features/projects/api/mappers';
import { useServersQuery } from '@/features/servers';
import {
  AccessAuditLog,
  ApiKeyDisplay,
  ApiKeyRevealModal,
  ApiKeyRotationModal,
  ProjectForm,
  RedirectUriManager,
  ServerAccessMatrix,
  type ServerAccessChange,
} from '@/features/projects/components';
import type { AccessMatrixEntry, ProjectFormValues } from '@/features/projects/types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Switch } from '@/shared/components/ui/switch';

interface ProjectDetailViewProps {
  id: string;
}

function ProjectDetailView({ id }: ProjectDetailViewProps) {
  const router = useRouter();
  const projectQuery = useProjectQuery(id);
  const apiKeyQuery = useApiKeyInfoQuery(id);
  const matrixQuery = useAccessMatrixQuery(id);
  const { data: servers = [] } = useServersQuery();

  const setAccessMutation = useSetServerAccessMutation(id);
  const revokeAccessMutation = useRevokeServerAccessMutation(id);
  const updateProjectMutation = useUpdateProjectMutation();
  const updateRedirectMutation = useUpdateRedirectUriMutation();
  const deactivateMutation = useDeactivateProjectMutation();
  const reactivateMutation = useReactivateProjectMutation();
  const deleteMutation = useDeleteProjectMutation();
  const regenerateMutation = useRegenerateApiKeyMutation();

  const [revealOpen, setRevealOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uris, setUris] = useState<string[]>([]);

  const accessMap = useMemo(() => {
    const map: Record<string, AccessMatrixEntry> = {};
    for (const entry of matrixQuery.data ?? []) {
      map[entry.serverId] = entry;
    }
    return map;
  }, [matrixQuery.data]);

  if (projectQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border p-6">
        <p className="text-body text-error">Failed to load this project.</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            void projectQuery.refetch();
            void apiKeyQuery.refetch();
            void matrixQuery.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const project = mapProjectResponse(projectQuery.data);

  function handleServerAccessChange(serverId: string, change: ServerAccessChange) {
    if (change.revoke) {
      revokeAccessMutation.mutate(serverId);
    } else if (change.operations) {
      setAccessMutation.mutate({
        serverId,
        payload: { operations: change.operations, scopes: change.scopes },
      });
    }
  }

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
  const matrixMutating = setAccessMutation.isPending || revokeAccessMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/projects')}
          className="-ml-2 mb-2"
        >
          <ArrowLeft aria-hidden="true" />
          Projects
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-hero">{project.name}</h1>
              {project.isInternal && <Badge variant="brand-light">Internal</Badge>}
            </div>
            {project.description && (
              <p className="text-body text-text-muted">{project.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
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
              <span className="text-overline text-text-subtle">
                {project.isActive ? 'Active' : 'Deactivated'}
              </span>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      <section
        aria-labelledby="api-key-heading"
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-text-muted" aria-hidden="true" />
          <h2 id="api-key-heading" className="text-heading">
            API key
          </h2>
        </div>
        {apiKeyQuery.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <ApiKeyDisplay
            prefix={apiKeyInfo?.prefix ?? project.apiKeyPrefix}
            isActive={project.isActive}
            onReveal={() => setRevealOpen(true)}
            onRegenerate={() => setRotationOpen(true)}
          />
        )}
      </section>

      <section
        aria-labelledby="server-access-heading"
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="server-access-heading" className="text-heading">
            Server access
          </h2>
          <p className="text-overline text-text-subtle">
            Grant or revoke access per server and tune which operations and scopes are allowed.
          </p>
        </div>
        <ServerAccessMatrix
          projectId={id}
          servers={servers}
          accessMap={accessMap}
          isMutating={matrixMutating}
          onChange={handleServerAccessChange}
        />
      </section>

      <section
        aria-labelledby="redirect-heading"
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="redirect-heading" className="text-heading">
            Redirect URIs
          </h2>
          <p className="text-overline text-text-subtle">
            Comma-separated callback URLs used for OAuth. Currently shows what you&apos;ve saved
            this session.
          </p>
        </div>
        <RedirectUriManager
          uris={uris}
          onAdd={handleAddRedirectUri}
          onRemove={handleRemoveRedirectUri}
          isSubmitting={updateRedirectMutation.isPending}
        />
      </section>

      <section
        aria-labelledby="audit-heading"
        className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5"
      >
        <div className="flex flex-col gap-1">
          <h2 id="audit-heading" className="text-heading">
            Access audit log
          </h2>
          <p className="text-overline text-text-subtle">
            Every grant, update, and revocation for this project.
          </p>
        </div>
        <AccessAuditLog projectId={id} />
      </section>

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 aria-hidden="true" />
          Delete project
        </Button>
      </div>

      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API key details</DialogTitle>
            <DialogDescription>
              Only the prefix is stored — the full key was shown once when created.
            </DialogDescription>
          </DialogHeader>
          {apiKeyQuery.isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : apiKeyInfo ? (
            <dl className="flex flex-col gap-3 text-body">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-subtle">Prefix</dt>
                <dd className="font-mono text-code text-text-normal">{apiKeyInfo.prefix ?? '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-subtle">Created</dt>
                <dd>{apiKeyInfo.createdAtLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-subtle">Last used</dt>
                <dd>{apiKeyInfo.lastUsedLabel ?? 'Never'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-text-subtle">Status</dt>
                <dd>
                  <Badge variant={apiKeyInfo.isActive ? 'success' : 'error'}>
                    {apiKeyInfo.isActive ? 'Active' : 'Deactivated'}
                  </Badge>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-body text-text-muted">Failed to load key details.</p>
          )}
        </DialogContent>
      </Dialog>

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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update the project&apos;s name, description, or visibility.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            mode="edit"
            project={project}
            isSubmitting={updateProjectMutation.isPending}
            onSubmit={handleSaveEdit}
          />
        </DialogContent>
      </Dialog>

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
