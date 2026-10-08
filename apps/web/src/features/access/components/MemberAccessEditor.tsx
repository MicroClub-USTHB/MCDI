'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, Lock, SearchX } from 'lucide-react';

import {
  useAccessCatalogQuery,
  useAccessRolesQuery,
  useMemberEffectiveQuery,
  useMemberOverridesQuery,
} from '@/features/access/api/queries';
import { useSetMemberOverridesMutation } from '@/features/access/api/mutations';
import { LevelControl, type LevelOption } from '@/features/access/components/LevelControl';
import { MemberChip } from '@/features/access/components/MemberChip';
import {
  loweredOverrides,
  overridesPayload,
  type Draft,
  type OverrideDraft,
} from '@/features/access/lib/grants';
import type { EffectiveSourceDto } from '@/features/access/types';
import { LoadingSkeleton } from '@/shared/components/common';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';
import { describeUnreachable, unreachableGrants } from '@/shared/lib/reachability';
import { useToastStore } from '@/shared/stores/toast';
import type { ApiError } from '@/shared/types';

type Choice = 'inherit' | 'none' | 'read' | 'write' | 'manage';

const OPTIONS: LevelOption<Choice>[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'manage', label: 'Manage' },
];

function sourceLabel(source: EffectiveSourceDto, roleNames: Map<string, string>): string {
  switch (source.type) {
    case 'root':
      return 'Root';
    case 'override':
      return 'Override';
    case 'role':
      return `Role: ${roleNames.get(source.roleId) ?? source.roleId}`;
    case 'none':
      return 'No grant';
  }
}

/**
 * One member's access: the effective level per resource with where it comes from, and an override
 * for each. Inherit leaves a resource out of the save, because the API replaces the whole set.
 */
export function MemberAccessEditor({ memberId }: { memberId: string }) {
  const showToast = useToastStore((state) => state.show);
  const effective = useMemberEffectiveQuery(memberId);
  const overrides = useMemberOverridesQuery(memberId);
  const roles = useAccessRolesQuery();
  const catalog = useAccessCatalogQuery();
  const mutation = useSetMemberOverridesMutation(memberId);

  const [edits, setEdits] = useState<OverrideDraft | null>(null);
  const [confirming, setConfirming] = useState(false);

  const roleNames = useMemo(
    () => new Map((roles.data ?? []).map((role) => [role.id, role.name])),
    [roles.data]
  );
  const effectiveLevels = useMemo(
    () =>
      effective.data
        ? (Object.fromEntries(
            Object.entries(effective.data.access).map(([resource, entry]) => [
              resource,
              entry.level,
            ])
          ) as Draft)
        : null,
    [effective.data]
  );

  if (effective.isError || overrides.isError) {
    const notFound =
      ((effective.error ?? overrides.error) as unknown as ApiError | null)?.status === 404;
    return (
      <EmptyState
        icon={notFound ? SearchX : AlertCircle}
        title={notFound ? 'Member not found' : 'Couldn’t load this member’s access'}
        description={notFound ? 'The member may no longer exist.' : undefined}
        actionLabel={notFound ? undefined : 'Retry'}
        onAction={
          notFound
            ? undefined
            : () => {
                void effective.refetch();
                void overrides.refetch();
              }
        }
      />
    );
  }
  if (!effective.data || !overrides.data || !catalog.data || !effectiveLevels) {
    return <LoadingSkeleton className="h-96 rounded-lg" />;
  }

  const member = effective.data;
  const saved: OverrideDraft = overrides.data.overrides;
  const draft = edits ?? saved;
  const dirty = JSON.stringify(overridesPayload(draft)) !== JSON.stringify(overridesPayload(saved));
  const lowered = loweredOverrides(effectiveLevels, draft);
  const hints = new Map(
    unreachableGrants(effectiveLevels).map((grant) => [grant.resource, describeUnreachable(grant)])
  );

  const header = (
    <MemberChip
      displayName={member.displayName}
      username={member.username}
      avatar={member.avatar}
    />
  );

  if (member.root) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5">
        {header}
        <div className="flex items-center gap-2 text-body text-text-muted">
          <Lock className="size-4" aria-hidden="true" />
          Full access through a root role. It cannot be changed here.
        </div>
      </section>
    );
  }

  function save() {
    mutation.mutate(overridesPayload(draft), {
      onSuccess: () => {
        setEdits(null);
        setConfirming(false);
        showToast('Overrides saved', 'success');
      },
      onError: (error) => {
        setConfirming(false);
        showToast(error.message || 'Failed to save the overrides', 'error');
      },
    });
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {header}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => setEdits(null)}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => (lowered.length > 0 ? setConfirming(true) : save())}
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="flex flex-col divide-y divide-border">
        {catalog.data.resources.map((resource) => {
          const entry = member.access[resource.key];
          return (
            <LevelControl<Choice>
              key={resource.key}
              name={`${memberId}-${resource.key}`}
              label={RESOURCE_TITLES[resource.key]}
              description={`Effective: ${entry.level} · ${sourceLabel(entry.source, roleNames)}`}
              hint={hints.get(resource.key)}
              value={draft[resource.key] ?? 'inherit'}
              options={OPTIONS}
              onChange={(next) => {
                const copy: OverrideDraft = { ...draft };
                if (next === 'inherit') delete copy[resource.key];
                else copy[resource.key] = next;
                setEdits(copy);
              }}
              disabled={mutation.isPending}
            />
          );
        })}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="destructive"
        title="Lower this member’s access?"
        description={`They lose this access immediately: ${lowered
          .map((resource) => RESOURCE_TITLES[resource])
          .join(', ')}.`}
        confirmLabel="Save changes"
        isConfirming={mutation.isPending}
        onConfirm={save}
      />
    </section>
  );
}
