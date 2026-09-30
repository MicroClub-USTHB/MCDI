'use client';

import { Loader2 } from 'lucide-react';

import { Checkbox } from '@/shared/components/ui/checkbox';
import type { PermissionCatalogEntry } from '@/features/roles/types';

interface PermissionCheckboxProps {
  permission: PermissionCatalogEntry;
  checked: boolean;
  isSaving: boolean;
  disabled?: boolean;
  /** Set so a wrapping `<label htmlFor>` toggles the checkbox. */
  id?: string;
  onChange: (permissionId: number, checked: boolean) => void;
}

function PermissionCheckbox({
  permission,
  checked,
  isSaving,
  disabled,
  id,
  onChange,
}: PermissionCheckboxProps) {
  return (
    <span className="relative inline-flex items-center">
      {isSaving && (
        <Loader2 className="absolute -left-5 size-3.5 animate-spin text-brand" aria-hidden="true" />
      )}
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled || isSaving}
        onCheckedChange={(value) => onChange(permission.id, value === true)}
        aria-label={`${checked ? 'Remove' : 'Add'} ${permission.key}`}
      />
    </span>
  );
}

export { PermissionCheckbox };
export type { PermissionCheckboxProps };
