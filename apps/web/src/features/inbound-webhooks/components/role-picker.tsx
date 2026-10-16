'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';

import type { RoleOption } from '@/features/inbound-webhooks/api/mappers';
import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McCheckbox } from '@/shared/components/ui/mc-checkbox';
import { McInput } from '@/shared/components/ui/mc-input';

interface RolePickerProps {
  options: RoleOption[];
  selected: string[];
  onChange: (roleIds: string[]) => void;
  isLoading?: boolean;
  /** Read-only: disables the search, the remove buttons and every option. */
  disabled?: boolean;
  /**
   * Set when the member cannot list roles (the list comes from `/admin/stats/roles`). The search and
   * the option list are replaced by this note, and the picker is read-only: nothing can be added.
   */
  unavailable?: string;
}

/** Who may read what the webhook receives. Default roles start selected and can be removed like any other. */
export function RolePicker({
  options,
  selected,
  onChange,
  isLoading,
  disabled: disabledProp = false,
  unavailable,
}: RolePickerProps) {
  const disabled = disabledProp || unavailable !== undefined;
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
        <p role="alert" className="paragraph-sm text-error">
          Pick at least one role, or nobody will be able to read what this webhook receives.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Selected roles">
          {selected.map((id) => {
            const role = byId.get(id);
            const name = role?.name ?? 'Unknown role';
            return (
              <li key={id}>
                <McBadge variant="secondary" size="md" className="gap-2 pr-1">
                  {name}
                  {role?.isDefault ? <span className="text-muted-foreground">default</span> : null}
                  <McButton
                    type="button"
                    variant="tertiary"
                    size="sm"
                    icon="only"
                    iconDefinition={<X aria-hidden="true" className="size-3" />}
                    disabled={disabled}
                    onClick={() => toggle(id)}
                    className="rounded-full bg-transparent p-0.5 text-current focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {`Remove ${name}`}
                  </McButton>
                </McBadge>
              </li>
            );
          })}
        </ul>
      )}

      {unavailable !== undefined ? (
        <p className="paragraph-sm text-muted-foreground">{unavailable}</p>
      ) : (
        <>
          <McInput
            type="search"
            addonStart={<Search aria-hidden="true" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search roles"
            aria-label="Search roles"
            disabled={disabled}
          />

          <ul className="relative max-h-60 overflow-y-auto rounded-md border border-border">
            {isLoading ? (
              <li className="px-3 py-2 paragraph-sm text-muted-foreground">Loading roles…</li>
            ) : shown.length === 0 ? (
              <li className="px-3 py-2 paragraph-sm text-muted-foreground">No roles found.</li>
            ) : (
              shown.map((option) => (
                <li key={option.id}>
                  <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted">
                    <McCheckbox
                      checked={selected.includes(option.id)}
                      disabled={disabled}
                      onCheckedChange={() => toggle(option.id)}
                      text={option.name}
                      supportText={option.serverName}
                      className="min-w-0 flex-1 [&_span_span:last-child:not(:first-child)]:text-muted-foreground"
                    />
                    {option.isDefault ? <McBadge variant="secondary">Default</McBadge> : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}
