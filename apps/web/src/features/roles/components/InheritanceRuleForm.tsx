'use client';

import { useState } from 'react';
import { McButton } from '@/shared/components/ui/mc-button';
import { McCheckbox } from '@/shared/components/ui/mc-checkbox';
import {
  McDialog,
  McDialogContent,
  McDialogFooter,
  McDialogHeader,
  McDialogTitle,
} from '@/shared/components/ui/mc-dialog';
import { McRadioGroup, McRadioGroupItem } from '@/shared/components/ui/mc-radio-group';
import {
  McSelect,
  McSelectContent,
  McSelectItem,
  McSelectTrigger,
  McSelectValue,
} from '@/shared/components/ui/mc-select';
import type { RoleStatsView } from '@/features/roles/api/mappers';
import type { CreateInheritanceRulePayload } from '@/features/roles/types';
import { useServersQuery } from '@/features/servers';

const LABEL_CLASS = 'text-sm font-medium text-muted-foreground';

interface InheritanceRuleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleStatsView[];
  onSave: (payload: CreateInheritanceRulePayload) => void;
  isSaving: boolean;
}

function InheritanceRuleForm({
  open,
  onOpenChange,
  roles,
  onSave,
  isSaving,
}: InheritanceRuleFormProps) {
  const { data: servers = [] } = useServersQuery();
  const [sourceRoleId, setSourceRoleId] = useState('');
  const [targetScope, setTargetScope] = useState<'all' | 'selected'>('all');
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(new Set());
  const [enabled, setEnabled] = useState(true);

  function handleToggleServer(serverId: string) {
    setSelectedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  }

  // Reset whenever the dialog closes, including when the parent flips `open` to
  // false after a successful save. Handled by the parent remounting this form via
  // a changing key (useEffect + synchronous setState would trip the compiler rule).
  function handleSave() {
    if (!sourceRoleId) return;
    onSave({
      sourceRoleId,
      targetScope,
      enabled,
      ...(targetScope === 'selected' ? { targetServerIds: Array.from(selectedServerIds) } : {}),
    });
  }

  function handleClose() {
    setSourceRoleId('');
    setTargetScope('all');
    setSelectedServerIds(new Set());
    setEnabled(true);
    onOpenChange(false);
  }

  const roleItems = roles.map((role) => ({ value: role.roleId, label: role.displayName }));

  return (
    <McDialog open={open} onOpenChange={handleClose}>
      <McDialogContent className="sm:min-h-0 sm:max-w-md">
        <McDialogHeader>
          <McDialogTitle>Create Inheritance Rule</McDialogTitle>
        </McDialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="inheritance-source-role" className={LABEL_CLASS}>
              Source Role (Main Server)
            </label>
            <McSelect
              items={roleItems}
              value={sourceRoleId || null}
              onValueChange={(value) => setSourceRoleId(value ?? '')}
            >
              <McSelectTrigger id="inheritance-source-role" className="w-full">
                <McSelectValue placeholder="Select a role" />
              </McSelectTrigger>
              <McSelectContent className="h-auto max-h-80 w-(--anchor-width)">
                {roleItems.map((item) => (
                  <McSelectItem key={item.value} value={item.value}>
                    {item.label}
                  </McSelectItem>
                ))}
              </McSelectContent>
            </McSelect>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className={LABEL_CLASS}>Target Scope</legend>
            <McRadioGroup
              value={targetScope}
              onValueChange={(value) => setTargetScope(value === 'selected' ? 'selected' : 'all')}
              className="flex gap-4"
            >
              <McRadioGroupItem value="all" text="All Servers" />
              <McRadioGroupItem value="selected" text="Selected Servers" />
            </McRadioGroup>
          </fieldset>

          {targetScope === 'selected' && (
            <fieldset className="flex flex-col gap-1.5">
              <legend className={LABEL_CLASS}>Target Servers</legend>
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                {servers
                  .filter((s) => s.isActive)
                  .map((server) => (
                    <McCheckbox
                      key={server.id}
                      text={server.name}
                      checked={selectedServerIds.has(server.id)}
                      onCheckedChange={() => handleToggleServer(server.id)}
                    />
                  ))}
              </div>
            </fieldset>
          )}

          <McCheckbox text="Enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <McDialogFooter className="pb-0">
          <McButton type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancel
          </McButton>
          <McButton
            type="button"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={!sourceRoleId || (targetScope === 'selected' && selectedServerIds.size === 0)}
          >
            Save Rule
          </McButton>
        </McDialogFooter>
      </McDialogContent>
    </McDialog>
  );
}

export { InheritanceRuleForm };
export type { InheritanceRuleFormProps };
