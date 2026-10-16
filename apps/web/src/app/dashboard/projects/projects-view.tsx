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
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';
import { useCan } from '@/shared/lib/use-access';
import { FolderKanban, Search } from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'inactive';

interface PendingAction {
  action: Exclude<ProjectAction, 'reactivate'>;
  project: ProjectView;
}

const PAGE_SIZE = 10;

const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Deactivated' },
];

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

  const canWrite = useCan('projects', 'write');

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
      description="Create your first project to connect an application to MCID."
      action={canWrite ? <CreateProjectButton /> : undefined}
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
          <h1 className="header-xs font-bold text-foreground">Projects</h1>
          <p className="mt-1 paragraph-sm text-muted-foreground">
            Applications that integrate with MCID and what they can access.
          </p>
        </div>
        {canWrite ? <CreateProjectButton /> : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <McInput
          type="search"
          addonStart={<Search aria-hidden="true" />}
          placeholder="Search projects…"
          aria-label="Search projects"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPageIndex(0);
          }}
          className="w-full max-w-xs"
        />
        <McSelect
          items={STATUS_ITEMS}
          value={statusFilter}
          onValueChange={(value) => {
            if (!value) return;
            setStatusFilter(value);
            setPageIndex(0);
          }}
        >
          <McSelectTrigger aria-label="Filter by status" className="w-40">
            <McSelectValue />
          </McSelectTrigger>
          <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
            {STATUS_ITEMS.map((item) => (
              <McSelectItem key={item.value} value={item.value}>
                {item.label}
              </McSelectItem>
            ))}
          </McSelectContent>
        </McSelect>
      </div>

      {projectsQuery.isError && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-6">
          <p className="paragraph-sm text-error">Failed to load projects.</p>
          <McButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void projectsQuery.refetch()}
          >
            Retry
          </McButton>
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
