'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { McTextarea } from '@/shared/components/ui/mc-textarea';

interface DisableServerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  onConfirm: (reason?: string) => void | Promise<void>;
  isSubmitting?: boolean;
}

function DisableServerModal({
  open,
  onOpenChange,
  serverName,
  onConfirm,
  isSubmitting = false,
}: DisableServerModalProps) {
  const [reason, setReason] = useState('');

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
      title={`Disable ${serverName}?`}
      description="Disabled servers are excluded from syncs and all API permission/member checks return 403."
      confirmLabel="Disable"
      variant="default"
      isConfirming={isSubmitting}
      onConfirm={() => onConfirm(reason.trim() || undefined)}
    >
      <McTextarea
        id="disable-reason"
        label="Reason (optional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why is this server being disabled?"
      />
    </ConfirmDialog>
  );
}

export { DisableServerModal, type DisableServerModalProps };
