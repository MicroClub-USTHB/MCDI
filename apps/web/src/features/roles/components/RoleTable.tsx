'use client';

import { Shield } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { getExecutiveRoleId, type RoleStatsView } from '@/features/roles/api/mappers';

interface RoleTableProps {
  roles: RoleStatsView[];
  selectedRoleId: string | null;
  permissionCounts: Map<string, number>;
  isLoadingPermissions: boolean;
  onSelectRole: (roleId: string) => void;
}

function RoleTable({
  roles,
  selectedRoleId,
  permissionCounts,
  isLoadingPermissions,
  onSelectRole,
}: RoleTableProps) {
  const executiveRoleId = getExecutiveRoleId(roles);

  return (
    <ul className="flex flex-col">
      {roles.map((role) => {
        const isSelected = role.roleId === selectedRoleId;
        const permCount = permissionCounts.get(role.roleId);
        const isExecutive = role.roleId === executiveRoleId;

        return (
          <li key={role.roleId} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => onSelectRole(role.roleId)}
              aria-current={isSelected ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
                isSelected
                  ? 'bg-brand/12 text-text-primary'
                  : 'text-text-normal hover:bg-surface-hover'
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full border border-border"
                style={role.colorHex ? { backgroundColor: role.colorHex } : undefined}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-body">{role.displayName}</span>
              {isExecutive && (
                <Shield className="size-3.5 shrink-0 text-warning" aria-label="Executive role" />
              )}
              <span
                className="shrink-0 rounded bg-surface-elevated px-1.5 py-0.5 text-overline text-text-subtle tabular-nums"
                title={`${permCount ?? 0} permission${permCount === 1 ? '' : 's'}`}
              >
                {isLoadingPermissions && permCount === undefined ? '…' : (permCount ?? 0)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export { RoleTable };
export type { RoleTableProps };
