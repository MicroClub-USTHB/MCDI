'use client';

import { useState } from 'react';

import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface DeleteServerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  onConfirm: () => void | Promise<void>;
  isSubmitting?: boolean;
}

function DeleteServerModal({
  open,
  onOpenChange,
  serverName,
  onConfirm,
  isSubmitting = false,
}: DeleteServerModalProps) {
  const [typedName, setTypedName] = useState('');

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTypedName('');
        onOpenChange(next);
      }}
      title={`Delete ${serverName}?`}
      description="This permanently removes the server and all associated data (members, roles, sync logs). This cannot be undone."
      confirmLabel="Delete"
      variant="destructive"
      isConfirming={isSubmitting}
      confirmDisabled={typedName !== serverName}
      onConfirm={onConfirm}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delete-confirm-name">
          Type <span className="font-semibold text-text-primary">{serverName}</span> to confirm
        </Label>
        <Input
          id="delete-confirm-name"
          value={typedName}
          onChange={(event) => setTypedName(event.target.value)}
          autoComplete="off"
        />
      </div>
    </ConfirmDialog>
  );
}

export { DeleteServerModal, type DeleteServerModalProps };
