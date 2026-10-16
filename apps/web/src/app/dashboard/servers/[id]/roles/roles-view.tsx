'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  useRoleStatsQuery,
  useAllRolePermissionsQuery,
  useInheritanceRulesQuery,
} from '@/features/roles/api/queries';
import { useCreateInheritanceRuleMutation } from '@/features/roles/api/mutations';
import { mapRoleStatsResponse, mapInheritanceRule } from '@/features/roles/api/mappers';
import { RoleTable, InheritanceRuleForm } from '@/features/roles/components';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SkeletonCard } from '@/shared/components/common/LoadingSkeleton';
import { Button } from '@/shared/components/ui/button';
import { useCan } from '@/shared/lib/use-access';
import { Shield, Plus } from 'lucide-react';
import type { CreateInheritanceRulePayload } from '@/features/roles/types';

/** Roles of the server in the URL; the sidebar's server switcher picks the server. */
export function RolesView({ serverId }: { serverId: string }) {
  const router = useRouter();
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  // Bumped on every close so the form remounts with fresh state instead of
  // using an effect-based reset (which would trip the compiler rule).
  const [formKey, setFormKey] = useState(0);
  const canWrite = useCan('roles', 'write');

  const statsQuery = useRoleStatsQuery(serverId);

  const stats = useMemo(
    () => (statsQuery.data ? mapRoleStatsResponse(statsQuery.data) : null),
    [statsQuery.data]
  );

  const roleIds = useMemo(() => stats?.roles.map((r) => r.roleId) ?? [], [stats?.roles]);
  const allPermsQuery = useAllRolePermissionsQuery(serverId, roleIds);

  const inheritanceQuery = useInheritanceRulesQuery(serverId ? { serverId: serverId } : undefined);
  const createRuleMutation = useCreateInheritanceRuleMutation();

  const inheritanceRules = useMemo(
    () => (inheritanceQuery.data ?? []).map(mapInheritanceRule),
    [inheritanceQuery.data]
  );

  function handleCreateRule(payload: CreateInheritanceRulePayload) {
    createRuleMutation.mutate(payload, { onSuccess: () => closeRuleDialog() });
  }

  function closeRuleDialog() {
    setRuleDialogOpen(false);
    // Remount the form so its internal state resets after a successful save.
    setFormKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="header-xs font-bold">Roles &amp; Permissions</h1>
          <p className="mt-1 paragraph-sm text-muted-foreground">
            Manage this server&apos;s role-permission mappings and inheritance rules.
          </p>
        </div>
        {canWrite && stats && stats.roles.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRuleDialogOpen(true)}
          >
            <Plus aria-hidden="true" />
            Add Inheritance Rule
          </Button>
        )}
      </div>

      {statsQuery.isError && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-6">
          <p className="paragraph-sm text-error">Failed to load roles.</p>
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => void statsQuery.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {statsQuery.isPending && <SkeletonCard lines={4} />}

      {!statsQuery.isPending && stats && stats.roles.length === 0 && (
        <EmptyState
          icon={<Shield className="size-6" aria-hidden="true" />}
          title="No roles found"
          description="No roles are available for this server."
        />
      )}

      {stats && stats.roles.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <h2 className="paragraph-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Roles
              </h2>
              <span className="paragraph-xs font-semibold tracking-wide text-muted-foreground/70 tabular-nums">
                {stats.roles.length}
              </span>
            </div>
            <RoleTable
              roles={stats.roles}
              selectedRoleId={null}
              permissionCounts={allPermsQuery.permissionCounts}
              isLoadingPermissions={allPermsQuery.isLoading}
              onSelectRole={(roleId) => {
                router.push(`/dashboard/servers/${serverId}/roles/${roleId}`);
              }}
            />
          </div>

          {inheritanceRules.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="paragraph-sm font-semibold text-foreground">Inheritance Rules</h2>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                {inheritanceRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-2.5"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {stats.roles.find((r) => r.roleId === rule.sourceRoleId)?.displayName ??
                          `Role ${rule.sourceRoleId}`}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {rule.targetScope === 'all' ? 'All servers' : 'Selected servers'} ·{' '}
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground/70">{rule.updatedAtLabel}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {canWrite && stats && (
        <InheritanceRuleForm
          key={formKey}
          open={ruleDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeRuleDialog();
            else setRuleDialogOpen(true);
          }}
          roles={stats.roles}
          onSave={handleCreateRule}
          isSaving={createRuleMutation.isPending}
        />
      )}
    </div>
  );
}
