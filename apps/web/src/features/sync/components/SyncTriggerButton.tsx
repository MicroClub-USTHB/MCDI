'use client';

import { RefreshCw } from 'lucide-react';

import { McButton } from '@/shared/components/ui/mc-button';
import type { TriggerFullSyncPayload } from '@/features/sync/types';

interface SyncTriggerButtonProps {
  target: 'all' | 'server';
  /** Required when `target` is `"server"` — the server(s) this button syncs. */
  serverIds?: string[];
  onTrigger: (payload: TriggerFullSyncPayload) => void;
  isPending?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function SyncTriggerButton({
  target,
  serverIds,
  onTrigger,
  isPending = false,
  disabled = false,
  size = 'md',
}: SyncTriggerButtonProps) {
  const label = target === 'all' ? 'Sync all servers' : 'Sync now';

  return (
    <McButton
      type="button"
      variant={target === 'all' ? 'primary' : 'secondary'}
      size={size}
      icon="leading"
      iconDefinition={<RefreshCw aria-hidden="true" />}
      isLoading={isPending}
      onClick={() =>
        onTrigger(target === 'all' ? { target: 'all' } : { serverIds: serverIds ?? [] })
      }
      disabled={disabled || isPending}
      aria-busy={isPending}
    >
      {isPending ? 'Starting…' : label}
    </McButton>
  );
}
