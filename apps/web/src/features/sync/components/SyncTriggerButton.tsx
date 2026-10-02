'use client';

import { Loader2, RefreshCw } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
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
    <Button
      type="button"
      variant={target === 'all' ? 'primary' : 'secondary'}
      size={size}
      onClick={() =>
        onTrigger(target === 'all' ? { target: 'all' } : { serverIds: serverIds ?? [] })
      }
      disabled={disabled || isPending}
      aria-busy={isPending}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCw className="size-4" aria-hidden="true" />
      )}
      <span>{isPending ? 'Starting…' : label}</span>
    </Button>
  );
}
