'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

import { useUpdateInboundSettingsMutation } from '@/features/inbound-webhooks/api/mutations';
import {
  useAllRoleOptions,
  useInboundSettingsQuery,
} from '@/features/inbound-webhooks/api/queries';
import { RolePicker } from '@/features/inbound-webhooks/components/role-picker';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useCan } from '@/shared/lib/use-access';
import { useToastStore } from '@/shared/stores/toast';

/** The roles every new inbound webhook starts with. Changing them leaves existing webhooks alone. */
export function DefaultReadersSettings() {
  const showToast = useToastStore((state) => state.show);
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
  if (!settings.data) return <Skeleton className="h-64 w-full" />;

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
        <p className="text-body text-text-muted">
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
          <p className="text-body text-text-muted">
            An empty list is allowed: new webhooks then need their readers picked by hand.
          </p>
          <Button
            type="button"
            className="self-end"
            disabled={!changed || update.isPending}
            onClick={save}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="self-start">
            Read only
          </Badge>
          <ul className="flex flex-wrap gap-2">
            {settings.data.defaultReaderRoles.map((role) => (
              <li key={role.id}>
                <Badge variant="outline">{role.name}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
