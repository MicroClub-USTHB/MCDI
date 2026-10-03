'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Shield } from 'lucide-react';

import {
  useRoleStatsQuery,
  useRolePermissionsQuery,
  useAllRolePermissionsQuery,
  useImpactPreviewQuery,
} from '@/features/roles/api/queries';
import {
  useAddPermissionsMutation,
  useRemovePermissionMutation,
} from '@/features/roles/api/mutations';
import {
  mapRoleStatsResponse,
  mapRolePermissionsResponse,
  getExecutiveRoleId,
} from '@/features/roles/api/mappers';
import {
  RoleTable,
  PermissionMatrix,
  ImpactPreview,
  HierarchyTree,
} from '@/features/roles/components';
import { SkeletonCard } from '@/shared/components/common/LoadingSkeleton';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { useToastStore } from '@/shared/stores';

interface RoleDetailViewProps {
  roleId: string;
  serverId: string;
}

type StagedAction = 'add' | 'remove';

function Panel({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-lg border border-border bg-surface-raised',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h2 className="text-overline text-text-subtle uppercase">{title}</h2>
        {count !== undefined && (
          <span className="text-overline text-text-faint tabular-nums">{count}</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function RoleDetailView({ roleId, serverId }: RoleDetailViewProps) {
  const router = useRouter();
  const toast = useToastStore((s) => s.show);

  const statsQuery = useRoleStatsQuery(serverId);
  const rolePermissionsQuery = useRolePermissionsQuery(serverId, roleId);

  const stats = useMemo(
    () => (statsQuery.data ? mapRoleStatsResponse(statsQuery.data) : null),
    [statsQuery.data]
  );

  const roleIds = useMemo(() => stats?.roles.map((r) => r.roleId) ?? [], [stats?.roles]);
  const allPermsQuery = useAllRolePermissionsQuery(serverId, roleIds);

  const currentRolePerms = useMemo(
    () =>
      rolePermissionsQuery.data ? mapRolePermissionsResponse(rolePermissionsQuery.data) : null,
    [rolePermissionsQuery.data]
  );

  const addMutation = useAddPermissionsMutation(serverId, roleId);
  const removeMutation = useRemovePermissionMutation(serverId, roleId);

  // Bulk edit: checkbox clicks stage a diff against current assignments;
  // nothing is written until the user confirms.
  const [staged, setStaged] = useState<Map<number, StagedAction>>(new Map());
  const [isApplying, setIsApplying] = useState(false);

  const executiveRoleId = stats ? getExecutiveRoleId(stats.roles) : null;
  const isExecutiveRole = executiveRoleId === roleId;

  const { addIds, removeIds } = useMemo(() => {
    const add: number[] = [];
    const remove: number[] = [];
    for (const [id, action] of staged) (action === 'add' ? add : remove).push(id);
    return { addIds: add.sort((a, b) => a - b), removeIds: remove.sort((a, b) => a - b) };
  }, [staged]);

  const addImpact = useImpactPreviewQuery(serverId, roleId, {
    permissionIds: addIds,
    action: 'add',
  });
  const removeImpact = useImpactPreviewQuery(serverId, roleId, {
    permissionIds: removeIds,
    action: 'remove',
  });

  const selectedRole = stats?.roles.find((r) => r.roleId === roleId);

  /** Current assignments with the staged diff applied. */
  const displayedPermissionIds = useMemo(() => {
    if (!currentRolePerms) return null;
    if (staged.size === 0) return currentRolePerms.permissionIds;
    const next = new Set(currentRolePerms.permissionIds);
    for (const [id, action] of staged) {
      if (action === 'add') next.add(id);
      else next.delete(id);
    }
    return next;
  }, [currentRolePerms, staged]);

  function handleToggle(permissionId: number, checked: boolean) {
    if (isApplying || isExecutiveRole || !currentRolePerms) return;
    const currentlyHas = currentRolePerms.permissionIds.has(permissionId);
    setStaged((prev) => {
      const next = new Map(prev);
      if (checked === currentlyHas) next.delete(permissionId);
      else next.set(permissionId, checked ? 'add' : 'remove');
      return next;
    });
  }

  function handleDiscard() {
    if (!isApplying) setStaged(new Map());
  }

  async function handleApply() {
    if (staged.size === 0 || isApplying) return;
    const total = addIds.length + removeIds.length;
    setIsApplying(true);
    try {
      if (addIds.length > 0) await addMutation.mutateAsync(addIds);
      for (const id of removeIds) await removeMutation.mutateAsync(id);
      await rolePermissionsQuery.refetch();
      setStaged(new Map());
      toast(`Applied ${total} permission change${total === 1 ? '' : 's'}.`, 'success');
    } catch {
      await rolePermissionsQuery.refetch();
      setStaged(new Map());
      toast('Some changes could not be applied. Review and retry.', 'error');
    } finally {
      setIsApplying(false);
    }
  }

  const permissionCount = (displayedPermissionIds ?? currentRolePerms?.permissionIds)?.size ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/dashboard/servers/${serverId}/roles`)}
        className="-ml-2 w-fit"
      >
        <ArrowLeft aria-hidden="true" />
        Roles
      </Button>

      {!stats && statsQuery.isPending && <SkeletonCard lines={4} />}

      {statsQuery.isError && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-6">
          <p className="text-body text-error">Failed to load roles.</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void statsQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {stats && stats.roles.length > 0 && (
        <div className="grid min-h-0 grid-cols-1 gap-4 lg:h-[calc(100dvh-11rem)] lg:min-h-[34rem] lg:grid-cols-[19rem_minmax(0,1fr)]">
          {/* ── Left rail: role list + hierarchy ── */}
          <aside className="flex min-h-0 flex-col gap-4 lg:overflow-hidden">
            <Panel title="Roles" count={stats.roles.length} className="flex-1">
              {roleIds.length === 0 ? (
                <div className="p-3">
                  <SkeletonCard lines={6} />
                </div>
              ) : (
                <RoleTable
                  roles={stats.roles}
                  selectedRoleId={roleId}
                  permissionCounts={allPermsQuery.permissionCounts}
                  isLoadingPermissions={allPermsQuery.isLoading}
                  onSelectRole={(nextRoleId) =>
                    router.push(`/dashboard/servers/${serverId}/roles/${nextRoleId}`)
                  }
                />
              )}
            </Panel>

            <Panel title="Hierarchy" className="h-[15rem] shrink-0">
              <div className="p-3">
                <HierarchyTree roles={stats.roles} activeRoleId={roleId} />
              </div>
            </Panel>
          </aside>

          {/* ── Right: selected role's permissions ── */}
          <section className="flex min-h-0 min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5 lg:overflow-hidden">
            <header className="shrink-0">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full border border-border"
                  style={
                    selectedRole?.colorHex ? { backgroundColor: selectedRole.colorHex } : undefined
                  }
                  aria-hidden="true"
                />
                <h1 className="truncate text-heading text-text-primary">
                  {selectedRole?.displayName ?? 'Role'}
                </h1>
                {isExecutiveRole && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/12 px-2 py-0.5 text-overline text-warning">
                    <Shield className="size-3" aria-hidden="true" />
                    Executive
                  </span>
                )}
              </div>
              <p className="mt-1 text-overline text-text-subtle">
                {permissionCount} permission{permissionCount === 1 ? '' : 's'} ·{' '}
                {selectedRole?.memberCount ?? 0} member
                {selectedRole?.memberCount === 1 ? '' : 's'} · Level{' '}
                {selectedRole?.hierarchyLevel ?? '—'}
              </p>
            </header>

            {rolePermissionsQuery.isPending && (
              <div className="min-h-0 flex-1">
                <SkeletonCard lines={10} />
              </div>
            )}

            {currentRolePerms && (
              <>
                {isExecutiveRole && (
                  <div className="shrink-0 rounded-lg border border-warning/30 bg-warning/12 px-4 py-3 text-body text-warning">
                    Executive role — permissions are locked.
                  </div>
                )}

                <PermissionMatrix
                  assignedIds={displayedPermissionIds ?? currentRolePerms.permissionIds}
                  savingIds={isApplying ? new Set(staged.keys()) : new Set()}
                  locked={isApplying || isExecutiveRole}
                  onToggle={handleToggle}
                />

                {staged.size > 0 && (
                  <div
                    className="flex shrink-0 flex-col gap-3 rounded-lg border border-border bg-surface-base p-4"
                    aria-live="polite"
                  >
                    <p className="text-body text-text-primary">
                      {[
                        addIds.length > 0 ? `${addIds.length} to add` : null,
                        removeIds.length > 0 ? `${removeIds.length} to remove` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    {addIds.length > 0 &&
                      (addImpact.isPending ? (
                        <p className="text-body text-text-muted">Checking impact of additions…</p>
                      ) : addImpact.data ? (
                        <ImpactPreview
                          affectedMembers={addImpact.data.affectedMembers}
                          roleHolders={addImpact.data.roleHolders}
                          action="add"
                        />
                      ) : null)}

                    {removeIds.length > 0 &&
                      (removeImpact.isPending ? (
                        <p className="text-body text-text-muted">Checking impact of removals…</p>
                      ) : removeImpact.data ? (
                        <ImpactPreview
                          affectedMembers={removeImpact.data.affectedMembers}
                          roleHolders={removeImpact.data.roleHolders}
                          action="remove"
                        />
                      ) : null)}

                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={handleApply} disabled={isApplying}>
                        {isApplying && (
                          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        )}
                        Apply {staged.size} change{staged.size === 1 ? '' : 's'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleDiscard}
                        disabled={isApplying}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export { RoleDetailView };
