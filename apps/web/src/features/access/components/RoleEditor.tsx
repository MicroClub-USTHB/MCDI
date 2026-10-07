'use client';

import { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';

import { useSetRoleGrantsMutation } from '@/features/access/api/mutations';
import { LevelControl, type LevelOption } from '@/features/access/components/LevelControl';
import {
  draftFromGrants,
  grantsPayload,
  isDirty,
  loweredResources,
  type Draft,
} from '@/features/access/lib/grants';
import type { AccessCatalogDto, AccessRoleDto } from '@/features/access/types';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';
import { describeUnreachable, unreachableGrants } from '@/shared/lib/reachability';
import { useToastStore } from '@/shared/stores/toast';

const OPTIONS: LevelOption<Draft[keyof Draft]>[] = [
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'write', label: 'Write' },
  { value: 'manage', label: 'Manage' },
];

/**
 * The grants of one role: a level per resource. Mount it with `key={role.id}` so it restarts when
 * another role is picked. The save replaces every grant of the role in one request.
 */
export function RoleEditor({ role, catalog }: { role: AccessRoleDto; catalog: AccessCatalogDto }) {
  const showToast = useToastStore((state) => state.show);
  const mutation = useSetRoleGrantsMutation();

  const saved = useMemo(() => draftFromGrants(role.grants), [role.grants]);
  const [edits, setEdits] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const draft = edits ?? saved;

  const dirty = isDirty(saved, draft);
  const lowered = loweredResources(saved, draft);
  const hints = useMemo(
    () =>
      new Map(
        unreachableGrants(draft).map((grant) => [grant.resource, describeUnreachable(grant)])
      ),
    [draft]
  );

  if (role.root) {
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-5">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-text-muted" aria-hidden="true" />
          <h2 className="text-heading text-text-primary">{role.name}</h2>
          <Badge variant="secondary">Root</Badge>
        </div>
        <p className="text-body text-text-muted">
          A root role holds full access to everything. It is set by the API configuration and cannot
          be edited here.
        </p>
      </section>
    );
  }

  function save() {
    mutation.mutate(
      { roleId: role.id, grants: grantsPayload(draft) },
      {
        onSuccess: () => {
          setEdits(null);
          setConfirming(false);
          showToast('Grants saved', 'success');
        },
        onError: (error) => {
          setConfirming(false);
          showToast(error.message || 'Failed to save the grants', 'error');
        },
      }
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface-raised p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-heading text-text-primary">{role.name}</h2>
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
        {catalog.resources.map((resource) => (
          <LevelControl
            key={resource.key}
            name={`${role.id}-${resource.key}`}
            label={RESOURCE_TITLES[resource.key]}
            description={resource.description}
            hint={hints.get(resource.key)}
            value={draft[resource.key]}
            options={OPTIONS}
            onChange={(next) => setEdits({ ...draft, [resource.key]: next })}
            disabled={mutation.isPending}
          />
        ))}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        variant="destructive"
        title="Lower this role’s access?"
        description={`Members with this role lose this access immediately: ${lowered
          .map((resource) => RESOURCE_TITLES[resource])
          .join(', ')}.`}
        confirmLabel="Save changes"
        isConfirming={mutation.isPending}
        onConfirm={save}
      />
    </section>
  );
}
