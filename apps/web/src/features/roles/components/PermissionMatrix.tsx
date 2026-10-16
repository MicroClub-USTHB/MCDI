'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { McInput } from '@/shared/components/ui/mc-input';
import { PERMISSION_CATALOG } from '@/features/roles/types';
import { PermissionCheckbox } from '@/features/roles/components/PermissionCheckbox';

interface PermissionMatrixProps {
  /** Permission ids the role currently has (with any staged changes already applied). */
  assignedIds: Set<number>;
  savingIds: Set<number>;
  /** Freeze every checkbox (executive role, or a batch being applied). */
  locked?: boolean;
  /** Permission ids the member may not touch (below their level). */
  lockedIds?: Set<number>;
  onToggle: (permissionId: number, checked: boolean) => void;
}

function PermissionMatrix({
  assignedIds,
  savingIds,
  locked = false,
  lockedIds,
  onToggle,
}: PermissionMatrixProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PERMISSION_CATALOG;
    return PERMISSION_CATALOG.filter(
      (p) => p.key.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <McInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter permissions…"
          aria-label="Filter permissions"
          addonStart={<Search aria-hidden="true" />}
          className="flex-1"
        />
        <span className="shrink-0 paragraph-xs font-semibold tracking-wide text-muted-foreground tabular-nums">
          {filtered.length}/{PERMISSION_CATALOG.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center paragraph-sm text-muted-foreground">
            No permissions match “{query}”.
          </p>
        ) : (
          <ul>
            {filtered.map((perm) => {
              const checked = assignedIds.has(perm.id);
              return (
                <li key={perm.id} className="border-b border-border last:border-b-0">
                  <div className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted has-data-disabled:opacity-70">
                    <label
                      htmlFor={`perm-${perm.id}`}
                      className="min-w-0 flex-1 cursor-pointer in-has-data-disabled:cursor-not-allowed"
                    >
                      <span className="block truncate font-mono text-xs text-foreground">
                        {perm.key}
                      </span>
                      <span className="block truncate paragraph-xs font-semibold tracking-wide text-muted-foreground">
                        {perm.description}
                      </span>
                    </label>
                    <PermissionCheckbox
                      id={`perm-${perm.id}`}
                      permission={perm}
                      checked={checked}
                      isSaving={savingIds.has(perm.id)}
                      disabled={locked || (lockedIds?.has(perm.id) ?? false)}
                      onChange={(_id, next) => onToggle(perm.id, next)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export { PermissionMatrix };
export type { PermissionMatrixProps };
