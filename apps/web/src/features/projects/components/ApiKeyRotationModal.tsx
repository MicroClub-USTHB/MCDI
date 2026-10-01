'use client';

import { ConfirmDialog } from '@/shared/components/ui/confirm-dialog';

interface ApiKeyRotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: () => void;
  isConfirming?: boolean;
}

/** Confirmation that precedes rotating a project's API key. */
function ApiKeyRotationModal({
  open,
  onOpenChange,
  projectName,
  onConfirm,
  isConfirming = false,
}: ApiKeyRotationModalProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      title="Regenerate API key?"
      description={`This will immediately invalidate the current API key for "${projectName}". Any integration using it will stop working until it's updated. This cannot be undone.`}
      confirmLabel="Regenerate key"
      onConfirm={onConfirm}
      isConfirming={isConfirming}
    />
  );
}

export { ApiKeyRotationModal, type ApiKeyRotationModalProps };
