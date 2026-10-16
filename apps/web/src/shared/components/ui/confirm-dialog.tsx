import * as React from 'react';

import { cn } from '@/shared/lib/utils';
import {
  McAlertDialog,
  McAlertDialogAction,
  McAlertDialogCancel,
  McAlertDialogContent,
  McAlertDialogDescription,
  McAlertDialogFooter,
  McAlertDialogHeader,
  McAlertDialogTitle,
} from '@/shared/components/ui/mc-alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  isConfirming?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

/** Asks before an action that changes or removes data; an mcoli-ui alert dialog. */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  isConfirming = false,
  confirmDisabled = false,
  children,
  className,
}: ConfirmDialogProps) {
  return (
    <McAlertDialog open={open} onOpenChange={onOpenChange}>
      <McAlertDialogContent className={cn('p-6', className)}>
        <McAlertDialogHeader>
          <McAlertDialogTitle>{title}</McAlertDialogTitle>
          {description && <McAlertDialogDescription>{description}</McAlertDialogDescription>}
        </McAlertDialogHeader>
        {children}
        <McAlertDialogFooter className="m-0 mt-2">
          <McAlertDialogCancel size="sm" disabled={isConfirming}>
            {cancelLabel}
          </McAlertDialogCancel>
          <McAlertDialogAction
            type="button"
            size="sm"
            destructive={variant === 'destructive'}
            isLoading={isConfirming}
            disabled={confirmDisabled}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </McAlertDialogAction>
        </McAlertDialogFooter>
      </McAlertDialogContent>
    </McAlertDialog>
  );
}

export { ConfirmDialog, type ConfirmDialogProps };
