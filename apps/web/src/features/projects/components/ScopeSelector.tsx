'use client';

import { PROJECT_SCOPES, type ProjectScope } from '@/features/projects/types';
import { McCheckbox } from '@/shared/components/ui/mc-checkbox';

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
          <McCheckbox
            key={scope}
            checked={checked}
            disabled={disabled}
            onCheckedChange={() => toggle(scope)}
            text={SCOPE_LABELS[scope]}
            supportText={SCOPE_HINTS[scope]}
            className="w-full rounded-lg border border-border bg-card p-3 transition-colors select-none hover:bg-muted"
          />
        );
      })}
    </fieldset>
  );
}

export { ScopeSelector, type ScopeSelectorProps };
