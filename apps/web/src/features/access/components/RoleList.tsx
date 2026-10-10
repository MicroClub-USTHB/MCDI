'use client';

import { Lock } from 'lucide-react';

import type { AccessRoleDto } from '@/features/access/types';
import { Badge } from '@/shared/components/ui/badge';
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
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-raised"
    >
      {ordered.map((role) => (
        <li key={role.id} className="border-b border-border last:border-b-0">
          <button
            type="button"
            aria-current={selectedId === role.id ? 'true' : undefined}
            onClick={() => onSelect(role.id)}
            className={cn(
              'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-body transition-colors',
              selectedId === role.id
                ? 'bg-surface-active text-text-primary'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
            )}
          >
            <span className="truncate">{role.name}</span>
            {role.root ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden="true" />
                <Badge variant="secondary">Root</Badge>
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
