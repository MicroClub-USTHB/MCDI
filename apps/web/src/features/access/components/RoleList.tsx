'use client';

import { Lock } from 'lucide-react';

import type { AccessRoleDto } from '@/features/access/types';
import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { cn } from '@/shared/lib/utils';

interface RoleListProps {
  roles: AccessRoleDto[];
  selectedId: string | null;
  onSelect: (roleId: string) => void;
}

/** The main server's roles in Discord order. Root roles carry a lock. */
export function RoleList({ roles, selectedId, onSelect }: RoleListProps) {
  const ordered = [...roles].sort((a, b) => (b.position ?? 0) - (a.position ?? 0));

  return (
    <ul
      aria-label="Roles"
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      {ordered.map((role) => (
        <li key={role.id} className="border-b border-border last:border-b-0">
          <McButton
            type="button"
            variant="tertiary"
            aria-current={selectedId === role.id ? 'true' : undefined}
            onClick={() => onSelect(role.id)}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-none px-3 py-2.5 text-left paragraph-sm font-normal whitespace-normal active:ring-0',
              selectedId === role.id
                ? 'bg-secondary text-secondary-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span className="truncate">{role.name}</span>
            {role.root ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden="true" />
                <McBadge variant="outline">Root</McBadge>
              </span>
            ) : null}
          </McButton>
        </li>
      ))}
    </ul>
  );
}
