'use client';

import { PROJECT_SCOPES, type ProjectScope } from '@/features/projects/types';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';

interface ScopeSelectorProps {
  selected: ProjectScope[];
  onChange: (selected: ProjectScope[]) => void;
  disabled?: boolean;
}

const SCOPE_LABELS: Record<ProjectScope, string> = {
  read_members: 'Read members',
  check_permissions: 'Check permissions',
};

const SCOPE_HINTS: Record<ProjectScope, string> = {
  read_members: 'Read membership and profile data',
  check_permissions: 'Ask whether a member can perform an operation',
};

function ScopeSelector({ selected, onChange, disabled = false }: ScopeSelectorProps) {
  function toggle(scope: ProjectScope) {
    const isSelected = selected.includes(scope);
    onChange(isSelected ? selected.filter((s) => s !== scope) : [...selected, scope]);
  }

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-2">
      <legend className="sr-only">Scopes</legend>
      {PROJECT_SCOPES.map((scope) => {
        const checked = selected.includes(scope);
        return (
          <Label
            key={scope}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface-main p-3 transition-colors select-none hover:bg-surface-hover"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggle(scope)}
              className="mt-0.5"
              aria-label={SCOPE_LABELS[scope]}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-body text-text-normal">{SCOPE_LABELS[scope]}</span>
              <span className="text-overline text-text-subtle">{SCOPE_HINTS[scope]}</span>
            </span>
          </Label>
        );
      })}
    </fieldset>
  );
}

export { ScopeSelector, type ScopeSelectorProps };
