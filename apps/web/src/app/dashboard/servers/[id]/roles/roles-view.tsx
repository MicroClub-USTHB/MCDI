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
import { ServerSelector, RoleTable, InheritanceRuleForm } from '@/features/roles/components';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { SkeletonCard } from '@/shared/components/common/LoadingSkeleton';
import { Button } from '@/shared/components/ui/button';
import { Shield, Plus } from 'lucide-react';
import type { CreateInheritanceRulePayload } from '@/features/roles/types';

function RolesPage() {
  const router = useRouter();
  const [selectedServerId, setSelectedServerId] = useState('');
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  // Bumped on every close so the form remounts with fresh state instead of
  // using an effect-based reset (which would trip the compiler rule).
  const [formKey, setFormKey] = useState(0);

  const statsQuery = useRoleStatsQuery(selectedServerId);

  const stats = useMemo(
    () => (statsQuery.data ? mapRoleStatsResponse(statsQuery.data) : null),
    [statsQuery.data]
  );

  const roleIds = useMemo(() => stats?.roles.map((r) => r.roleId) ?? [], [stats?.roles]);
  const allPermsQuery = useAllRolePermissionsQuery(selectedServerId, roleIds);

  const inheritanceQuery = useInheritanceRulesQuery(
    selectedServerId ? { serverId: selectedServerId } : undefined
  );
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
          <h1 className="text-hero">Roles &amp; Permissions</h1>
          <p className="mt-1 text-body text-text-muted">
            Manage role-permission mappings and configure inheritance rules across servers.
          </p>
        </div>
        {stats && stats.roles.length > 0 && (
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

      <ServerSelector
        selected={selectedServerId}
        onChange={(id) => {
          setSelectedServerId(id);
        }}
      />

      {statsQuery.isError && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-6">
          <p className="text-body text-error">Failed to load roles.</p>
          <button
            type="button"
            className="text-sm text-brand underline"
            onClick={() => void statsQuery.refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {statsQuery.isPending && selectedServerId && <SkeletonCard lines={4} />}

      {!statsQuery.isPending && stats && stats.roles.length === 0 && (
        <EmptyState
          icon={<Shield className="size-6" aria-hidden="true" />}
          title="No roles found"
          description="No roles are available for this server."
        />
      )}

      {stats && stats.roles.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <h2 className="text-overline text-text-subtle uppercase">Roles</h2>
              <span className="text-overline text-text-faint tabular-nums">
                {stats.roles.length}
              </span>
            </div>
            <RoleTable
              roles={stats.roles}
              selectedRoleId={null}
              permissionCounts={allPermsQuery.permissionCounts}
              isLoadingPermissions={allPermsQuery.isLoading}
              onSelectRole={(roleId) => {
                router.push(`/dashboard/roles/${roleId}?server=${selectedServerId}`);
              }}
            />
          </div>

          {inheritanceRules.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-subhead text-text-primary">Inheritance Rules</h2>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-4">
                {inheritanceRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-md border border-border bg-surface-base px-4 py-2.5"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-text-primary">
                        {stats.roles.find((r) => r.roleId === rule.sourceRoleId)?.displayName ??
                          `Role ${rule.sourceRoleId}`}
                      </span>
                      <span className="text-xs text-text-subtle">
                        {rule.targetScope === 'all' ? 'All servers' : 'Selected servers'} ·{' '}
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <span className="text-xs text-text-faint">{rule.updatedAtLabel}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {stats && (
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

export default RolesPage;
