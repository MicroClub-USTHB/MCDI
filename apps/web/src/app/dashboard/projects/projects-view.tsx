'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useProjectsQuery } from '@/features/projects/api/queries';
import {
  useDeactivateProjectMutation,
  useDeleteProjectMutation,
  useReactivateProjectMutation,
} from '@/features/projects/api/mutations';
import { mapProjectResponse, type ProjectView } from '@/features/projects/api/mappers';
import {
  CreateProjectButton,
  ProjectTable,
  type ProjectAction,
} from '@/features/projects/components';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SearchInput } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { FolderKanban } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'inactive';

interface PendingAction {
  action: Exclude<ProjectAction, 'reactivate'>;
  project: ProjectView;
}

const PAGE_SIZE = 10;

function ProjectsView() {
  const router = useRouter();
  const projectsQuery = useProjectsQuery();
  const deactivateMutation = useDeactivateProjectMutation();
  const reactivateMutation = useReactivateProjectMutation();
  const deleteMutation = useDeleteProjectMutation();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const projects = useMemo(
    () => (projectsQuery.data ?? []).map(mapProjectResponse),
    [projectsQuery.data]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (term && !project.name.toLowerCase().includes(term)) return false;
      if (statusFilter === 'active' && !project.isActive) return false;
      if (statusFilter === 'inactive' && project.isActive) return false;
      return true;
    });
  }, [projects, search, statusFilter]);

  const emptyState = (
    <EmptyState
      icon={<FolderKanban className="size-6" aria-hidden="true" />}
      title="No projects"
      description="Create your first project to connect an application to MCDI."
      action={<CreateProjectButton />}
    />
  );

  function handleAction(action: ProjectAction, project: ProjectView) {
    if (action === 'reactivate') {
      reactivateMutation.mutate(project.id);
    } else {
      setPending({ action, project });
    }
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.action === 'deactivate') {
      deactivateMutation.mutate(pending.project.id, { onSettled: () => setPending(null) });
    } else if (pending.action === 'delete') {
      deleteMutation.mutate(pending.project.id, { onSettled: () => setPending(null) });
    }
  }

  const isConfirming =
    (pending?.action === 'deactivate' && deactivateMutation.isPending) ||
    (pending?.action === 'delete' && deleteMutation.isPending);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-hero">Projects</h1>
          <p className="mt-1 text-body text-text-muted">
            Applications that integrate with MCDI and what they can access.
          </p>
        </div>
        <CreateProjectButton />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Search projects…"
          aria-label="Search projects"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPageIndex(0);
          }}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as StatusFilter);
            setPageIndex(0);
          }}
        >
          <SelectTrigger aria-label="Filter by status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {projectsQuery.isError && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-6">
          <p className="text-body text-error">Failed to load projects.</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void projectsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!projectsQuery.isPending && filtered.length === 0 && !projectsQuery.isError ? (
        emptyState
      ) : (
        <ProjectTable
          projects={filtered}
          isLoading={projectsQuery.isPending}
          onAction={handleAction}
          onRowClick={(project) => router.push(`/dashboard/projects/${project.id}`)}
          pageIndex={pageIndex}
          pageSize={PAGE_SIZE}
          onPageChange={setPageIndex}
          emptyState={emptyState}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !(deactivateMutation.isPending || deleteMutation.isPending)) {
            setPending(null);
          }
        }}
        variant={pending?.action === 'delete' ? 'destructive' : 'default'}
        title={pending?.action === 'delete' ? 'Delete project?' : 'Deactivate project?'}
        description={
          pending?.action === 'delete'
            ? `This permanently deletes "${pending?.project.name}" and all of its server access. This cannot be undone.`
            : `Deactivating "${pending?.project.name}" blocks ALL of its API access immediately — not just its key. Reactivate it any time.`
        }
        confirmLabel={pending?.action === 'delete' ? 'Delete project' : 'Deactivate project'}
        onConfirm={confirmPending}
        isConfirming={isConfirming}
      />
    </div>
  );
}

export { ProjectsView };
