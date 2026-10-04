'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

import type { RoleOption } from '@/features/inbound-webhooks/api/mappers';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { SearchInput } from '@/shared/components/ui/input';

interface RolePickerProps {
  options: RoleOption[];
  selected: string[];
  onChange: (roleIds: string[]) => void;
  isLoading?: boolean;
}

/** Who may read the submissions. Default roles start selected and can be removed like any other. */
export function RolePicker({ options, selected, onChange, isLoading }: RolePickerProps) {
  const [search, setSearch] = useState('');
  const byId = new Map(options.map((option) => [option.id, option]));
  const needle = search.trim().toLowerCase();
  const shown = options.filter((option) =>
    `${option.name} ${option.serverName}`.toLowerCase().includes(needle)
  );

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((roleId) => roleId !== id) : [...selected, id]
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.length === 0 ? (
        <p role="alert" className="text-body text-error">
          Pick at least one role, or nobody will be able to read the submissions.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Selected roles">
          {selected.map((id) => {
            const role = byId.get(id);
            const name = role?.name ?? 'Unknown role';
            return (
              <li key={id}>
                <Badge variant="brand-light" className="gap-2">
                  {name}
                  {role?.isDefault ? <span className="text-text-subtle">default</span> : null}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => toggle(id)}
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    <X aria-hidden="true" />
                  </button>
                </Badge>
              </li>
            );
          })}
        </ul>
      )}

      <SearchInput
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search roles"
        aria-label="Search roles"
      />

      <ul className="max-h-60 overflow-y-auto rounded-md border border-border">
        {isLoading ? (
          <li className="px-3 py-2 text-body text-text-subtle">Loading roles…</li>
        ) : shown.length === 0 ? (
          <li className="px-3 py-2 text-body text-text-subtle">No roles found.</li>
        ) : (
          shown.map((option) => (
            <li key={option.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover">
                <Checkbox
                  checked={selected.includes(option.id)}
                  onCheckedChange={() => toggle(option.id)}
                  aria-label={option.name}
                />
                <span className="text-body text-text-normal">{option.name}</span>
                <span className="text-body text-text-subtle">{option.serverName}</span>
                {option.isDefault ? <Badge variant="secondary">Default</Badge> : null}
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
