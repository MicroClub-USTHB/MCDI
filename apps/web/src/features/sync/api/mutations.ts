'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { syncKeys } from '@/features/sync/api/keys';
import { triggerFullSync } from '@/features/sync/api/service';
import type { TriggerFullSyncPayload } from '@/features/sync/types';
import { showToast } from '@/shared/stores';

export function useTriggerSyncMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TriggerFullSyncPayload) => triggerFullSync(payload),
    onSuccess: (response) => {
      const failed = response.data.results.filter((result) => result.error);
      if (failed.length > 0) {
        showToast(
          `Sync started — ${failed.length} server${failed.length === 1 ? '' : 's'} could not be queued`,
          'warning'
        );
      } else {
        showToast('Sync started', 'success');
      }
      void queryClient.invalidateQueries({ queryKey: syncKeys.statuses() });
    },
    onError: () => {
      showToast('Could not start sync', 'error');
    },
  });
}
