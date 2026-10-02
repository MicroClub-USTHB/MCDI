'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import type { RoleStatsView } from '@/features/roles/api/mappers';
import type { CreateInheritanceRulePayload } from '@/features/roles/types';
import { useServersQuery } from '@/features/servers';

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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface-raised sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text-primary">Create Inheritance Rule</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-subtle">
              Source Role (Main Server)
            </label>
            <Select value={sourceRoleId} onValueChange={setSourceRoleId}>
              <SelectTrigger className="bg-surface-base">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.roleId} value={role.roleId}>
                    {role.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-medium text-text-subtle">Target Scope</legend>
            <div className="flex gap-4">
              {(['all', 'selected'] as const).map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm text-text-normal">
                  <input
                    type="radio"
                    name="targetScope"
                    value={scope}
                    checked={targetScope === scope}
                    onChange={() => setTargetScope(scope)}
                    className="size-4 accent-brand"
                  />
                  {scope === 'all' ? 'All Servers' : 'Selected Servers'}
                </label>
              ))}
            </div>
          </fieldset>

          {targetScope === 'selected' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-subtle">Target Servers</label>
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                {servers
                  .filter((s) => s.isActive)
                  .map((server) => (
                    <label
                      key={server.id}
                      className="flex items-center gap-2 text-sm text-text-normal"
                    >
                      <Checkbox
                        checked={selectedServerIds.has(server.id)}
                        onCheckedChange={() => handleToggleServer(server.id)}
                      />
                      {server.name}
                    </label>
                  ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-text-normal">
            <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
            Enabled
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              !sourceRoleId ||
              isSaving ||
              (targetScope === 'selected' && selectedServerIds.size === 0)
            }
          >
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { InheritanceRuleForm };
export type { InheritanceRuleFormProps };
