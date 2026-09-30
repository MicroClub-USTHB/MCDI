'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { PERMISSION_CATALOG } from '@/features/roles/types';
import { PermissionCheckbox } from '@/features/roles/components/PermissionCheckbox';

interface PermissionMatrixProps {
  /** Permission ids the role currently has (with any staged changes already applied). */
  assignedIds: Set<number>;
  savingIds: Set<number>;
  /** Freeze every checkbox (executive role, or a batch being applied). */
  locked?: boolean;
  onToggle: (permissionId: number, checked: boolean) => void;
}

function PermissionMatrix({
  assignedIds,
  savingIds,
  locked = false,
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
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter permissions…"
            aria-label="Filter permissions"
            className="h-9 w-full rounded-md border border-border bg-surface-base pr-3 pl-9 text-body text-text-normal outline-none transition-colors focus:border-border-focus"
          />
        </div>
        <span className="shrink-0 text-overline text-text-subtle tabular-nums">
          {filtered.length}/{PERMISSION_CATALOG.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-body text-text-muted">
            No permissions match “{query}”.
          </p>
        ) : (
          <ul>
            {filtered.map((perm) => {
              const checked = assignedIds.has(perm.id);
              return (
                <li key={perm.id} className="border-b border-border last:border-b-0">
                  <label
                    htmlFor={`perm-${perm.id}`}
                    className="flex cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-code text-text-primary">
                        {perm.key}
                      </span>
                      <span className="block truncate text-overline text-text-faint">
                        {perm.description}
                      </span>
                    </span>
                    <PermissionCheckbox
                      id={`perm-${perm.id}`}
                      permission={perm}
                      checked={checked}
                      isSaving={savingIds.has(perm.id)}
                      disabled={locked}
                      onChange={(_id, next) => onToggle(perm.id, next)}
                    />
                  </label>
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
