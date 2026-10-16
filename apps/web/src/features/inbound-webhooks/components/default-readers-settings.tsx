'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { useUpdateInboundSettingsMutation } from '@/features/inbound-webhooks/api/mutations';
import {
  useAllRoleOptions,
  useInboundSettingsQuery,
} from '@/features/inbound-webhooks/api/queries';
import { RolePicker } from '@/features/inbound-webhooks/components/role-picker';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McSkeleton } from '@/shared/components/ui/mc-skeleton';
import { useCan } from '@/shared/lib/use-access';
import { showToast } from '@/shared/stores';

/** The roles every new inbound webhook starts with. Changing them leaves existing webhooks alone. */
export function DefaultReadersSettings() {
  const settings = useInboundSettingsQuery();
  const roles = useAllRoleOptions();
  const update = useUpdateInboundSettingsMutation();
  const [picked, setPicked] = useState<string[] | null>(null);
  const canWrite = useCan('inbound_webhooks', 'write');
  const canServers = useCan('servers', 'read');
  const canStats = useCan('stats', 'read');
  const canEdit = canWrite && canServers && canStats;

  if (settings.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load the settings"
        actionLabel="Retry"
        onAction={() => void settings.refetch()}
      />
    );
  }
  if (!settings.data) return <McSkeleton rectangle className="h-64 w-full" />;

  const saved = settings.data.defaultReaderRoleIds;
  const selected = picked ?? saved;
  const changed = selected.length !== saved.length || selected.some((id) => !saved.includes(id));

  function save() {
    update.mutate(selected, {
      onSuccess: () => {
        setPicked(null);
        showToast('Default readers saved', 'success');
      },
      onError: (error) => showToast(error.message || 'Failed to save the default readers', 'error'),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {settings.data.source === 'environment' ? (
        <p className="paragraph-sm text-muted-foreground">
          These come from the server configuration until you save a list of your own.
        </p>
      ) : null}
      {canEdit ? (
        <>
          <RolePicker
            options={roles.options}
            selected={selected}
            onChange={setPicked}
            isLoading={roles.isLoading}
          />
          <p className="paragraph-sm text-muted-foreground">
            An empty list is allowed: new webhooks then need their readers picked by hand.
          </p>
          <McButton
            type="button"
            className="self-end"
            disabled={!changed || update.isPending}
            onClick={save}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </McButton>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <McBadge variant="secondary" className="self-start">
            Read only
          </McBadge>
          <ul className="flex flex-wrap gap-2">
            {settings.data.defaultReaderRoles.map((role) => (
              <li key={role.id}>
                <McBadge variant="outline">{role.name}</McBadge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
