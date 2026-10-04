'use client';

import { useState } from 'react';

import { useReplaceAllowedRolesMutation } from '@/features/inbound-webhooks/api/mutations';
import {
  useAllowedRolesQuery,
  useProjectRoleOptions,
} from '@/features/inbound-webhooks/api/queries';
import type { RoleOption } from '@/features/inbound-webhooks/api/mappers';
import { RolePicker } from '@/features/inbound-webhooks/components/role-picker';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useToastStore } from '@/shared/stores/toast';

/** Who may read the submissions. The list is replaced as a whole and may not be empty. */
export function WebhookReadersSection({ webhook }: { webhook: InboundWebhookDto }) {
  const showToast = useToastStore((state) => state.show);
  const granted = useAllowedRolesQuery(webhook.id);
  const roles = useProjectRoleOptions(webhook.projectId);
  const replace = useReplaceAllowedRolesMutation(webhook.id);
  const [picked, setPicked] = useState<string[] | null>(null);

  if (granted.isError) {
    return <p className="text-body text-error">The reader roles could not be loaded.</p>;
  }
  if (!granted.data) return <Skeleton className="h-48 w-full" />;

  const current = granted.data.map((role) => role.roleId);
  const selected = picked ?? current;
  const changed =
    selected.length !== current.length || selected.some((id) => !current.includes(id));

  // A role granted earlier may sit on a server the project cannot pick from today; keep it listed.
  const known = new Set(roles.options.map((option) => option.id));
  const options: RoleOption[] = [
    ...roles.options,
    ...granted.data
      .filter((role) => !known.has(role.roleId))
      .map((role) => ({ id: role.roleId, name: role.roleName, serverName: '', isDefault: false })),
  ];

  function save() {
    replace.mutate(selected, {
      onSuccess: () => {
        setPicked(null);
        showToast('Readers saved', 'success');
      },
      onError: (error) => showToast(error.message || 'Failed to save the readers', 'error'),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-body text-text-muted">
        Members holding one of these Discord roles can read this webhook&apos;s submissions.
      </p>
      <RolePicker
        options={options}
        selected={selected}
        onChange={setPicked}
        isLoading={roles.isLoading}
      />
      <Button
        type="button"
        className="self-end"
        disabled={!changed || selected.length === 0 || replace.isPending}
        onClick={save}
      >
        {replace.isPending ? 'Saving…' : 'Save readers'}
      </Button>
    </div>
  );
}
