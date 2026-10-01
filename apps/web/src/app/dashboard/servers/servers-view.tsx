'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Server as ServerIcon } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useToastStore } from '@/shared/stores/toast';
import {
  CreateServerButton,
  DeleteServerModal,
  DisableServerModal,
  ServerFilters,
  ServerForm,
  ServerTable,
  useCreateServerMutation,
  useDeleteServerMutation,
  useDisableServerMutation,
  useEnableServerMutation,
  useServersQuery,
  type ServerListItemDto,
  type ServerStatusFilter,
  type ServerTypeFilter,
} from '@/features/servers';

const PAGE_SIZE = 20;

function ServersView() {
  const router = useRouter();
  const { data: servers, isPending, isError, error, refetch } = useServersQuery();
  const showToast = useToastStore((state) => state.show);

  const [search, setSearch] = useState('');
  const [type, setType] = useState<ServerTypeFilter>('all');
  const [status, setStatus] = useState<ServerStatusFilter>('all');
  const [pageIndex, setPageIndex] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [disablingServer, setDisablingServer] = useState<ServerListItemDto | null>(null);
  const [deletingServer, setDeletingServer] = useState<ServerListItemDto | null>(null);

  const createMutation = useCreateServerMutation();
  const disableMutation = useDisableServerMutation();
  const enableMutation = useEnableServerMutation();
  const deleteMutation = useDeleteServerMutation();

  const filtered = useMemo(() => {
    if (!servers) return [];
    const normalizedSearch = search.trim().toLowerCase();

    return servers.filter((server) => {
      if (normalizedSearch && !server.name.toLowerCase().includes(normalizedSearch)) return false;
      if (type !== 'all' && server.type !== type) return false;
      if (status === 'active' && !server.isActive) return false;
      if (status === 'inactive' && server.isActive) return false;
      return true;
    });
  }, [servers, search, type, status]);

  const hasActiveFilters = search.trim() !== '' || type !== 'all' || status !== 'all';
  const safePageIndex = Math.min(
    pageIndex,
    Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1)
  );

  function handleAction(action: 'disable' | 'enable' | 'delete', server: ServerListItemDto) {
    if (action === 'disable') {
      setDisablingServer(server);
    } else if (action === 'delete') {
      setDeletingServer(server);
    } else {
      enableMutation.mutate(server.id, {
        onSuccess: () => showToast(`${server.name} enabled`, 'success'),
        onError: (mutationError) =>
          showToast(mutationError.message || 'Failed to enable server', 'error'),
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ServerFilters
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPageIndex(0);
          }}
          type={type}
          onTypeChange={(value) => {
            setType(value);
            setPageIndex(0);
          }}
          status={status}
          onStatusChange={(value) => {
            setStatus(value);
            setPageIndex(0);
          }}
        />
        <CreateServerButton onClick={() => setCreateOpen(true)} />
      </div>

      {isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-error/12 p-4 text-error">
          <p className="text-body">{error.message || 'Failed to load servers.'}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : !isPending && filtered.length === 0 ? (
        <EmptyState
          icon={<ServerIcon className="size-8" />}
          title={hasActiveFilters ? 'No servers match your filters' : 'No servers registered'}
          description={
            hasActiveFilters
              ? 'Try adjusting or clearing your search and filters.'
              : 'Add a Discord server to start managing it from MCDI.'
          }
          action={
            hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setType('all');
                  setStatus('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <CreateServerButton onClick={() => setCreateOpen(true)} />
            )
          }
        />
      ) : (
        <ServerTable
          servers={filtered}
          isLoading={isPending}
          onAction={handleAction}
          onRowClick={(server) => router.push(`/dashboard/servers/${server.id}`)}
          pageIndex={safePageIndex}
          pageSize={PAGE_SIZE}
          onPageChange={setPageIndex}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Server</DialogTitle>
          </DialogHeader>
          <ServerForm
            mode="create"
            isSubmitting={createMutation.isPending}
            onSubmit={(payload) =>
              createMutation.mutate(payload, {
                onSuccess: () => {
                  setCreateOpen(false);
                  showToast('Server added', 'success');
                },
                onError: (mutationError) =>
                  showToast(mutationError.message || 'Failed to add server', 'error'),
              })
            }
          />
        </DialogContent>
      </Dialog>

      {disablingServer && (
        <DisableServerModal
          open={!!disablingServer}
          onOpenChange={(open) => !open && setDisablingServer(null)}
          serverName={disablingServer.name}
          isSubmitting={disableMutation.isPending}
          onConfirm={(reason) =>
            disableMutation.mutate(
              { id: disablingServer.id, payload: { disabledReason: reason } },
              {
                onSuccess: () => {
                  showToast(`${disablingServer.name} disabled`, 'success');
                  setDisablingServer(null);
                },
                onError: (mutationError) =>
                  showToast(mutationError.message || 'Failed to disable server', 'error'),
              }
            )
          }
        />
      )}

      {deletingServer && (
        <DeleteServerModal
          open={!!deletingServer}
          onOpenChange={(open) => !open && setDeletingServer(null)}
          serverName={deletingServer.name}
          isSubmitting={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(deletingServer.id, {
              onSuccess: () => {
                showToast(`${deletingServer.name} deleted`, 'success');
                setDeletingServer(null);
              },
              onError: (mutationError) =>
                showToast(mutationError.message || 'Failed to delete server', 'error'),
            })
          }
        />
      )}
    </div>
  );
}

export { ServersView };
