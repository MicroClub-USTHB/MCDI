'use client';

import { Shield } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { getExecutiveRoleId, type RoleStatsView } from '@/features/roles/api/mappers';

interface HierarchyTreeProps {
  roles: RoleStatsView[];
  /** Highlight this role in the ladder. */
  activeRoleId?: string | null;
}

function HierarchyTree({ roles, activeRoleId = null }: HierarchyTreeProps) {
  const sorted = [...roles].sort((a, b) => (a.hierarchyLevel ?? 0) - (b.hierarchyLevel ?? 0));
  const executiveRoleId = getExecutiveRoleId(roles);

  return (
    <ol className="flex flex-col">
      {sorted.map((role, index) => {
        const isLast = index === sorted.length - 1;
        const isExecutive = role.roleId === executiveRoleId;
        const isActive = role.roleId === activeRoleId;

        return (
          <li key={role.roleId} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-overline tabular-nums',
                  isExecutive
                    ? 'border-brand bg-brand/15 text-brand-light'
                    : 'border-border bg-surface-base text-text-subtle'
                )}
              >
                {index + 1}
              </span>
              {!isLast && <span className="w-px flex-1 bg-border" />}
            </div>
            <div
              className={cn(
                'mb-2 flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1',
                isActive && 'bg-brand/10'
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full border border-border"
                style={role.colorHex ? { backgroundColor: role.colorHex } : undefined}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-body text-text-normal">
                {role.displayName}
              </span>
              {isExecutive && (
                <Shield className="size-3 shrink-0 text-warning" aria-label="Executive role" />
              )}
              <span className="shrink-0 text-overline text-text-faint tabular-nums">
                {role.memberCount}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export { HierarchyTree };
export type { HierarchyTreeProps };
