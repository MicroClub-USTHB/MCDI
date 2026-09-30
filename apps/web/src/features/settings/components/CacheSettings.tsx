'use client';

import { useState } from 'react';
import { Database } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import {
  cacheSettingsSchema,
  type CacheSettingsFormErrors,
  type CacheSettingsFormValues,
} from '@/features/settings/components/settings-forms.schema';
import type { CacheSettingsGroup, UpdateSettingsPayload } from '@/features/settings/types';

interface CacheSettingsProps {
  settings: CacheSettingsGroup;
  onSave: (payload: UpdateSettingsPayload) => void;
  isSaving?: boolean;
}

function toValues(settings: CacheSettingsGroup): CacheSettingsFormValues {
  return {
    permissionTtlMs: settings.permissionTtlMs.value,
    statsTtlMs: settings.statsTtlMs.value,
  };
}

function CacheSettings({ settings, onSave, isSaving = false }: CacheSettingsProps) {
  const [values, setValues] = useState<CacheSettingsFormValues>(() => toValues(settings));
  const [errors, setErrors] = useState<CacheSettingsFormErrors>({});
  const isDirty =
    values.permissionTtlMs !== settings.permissionTtlMs.value ||
    values.statsTtlMs !== settings.statsTtlMs.value;

  function setField(key: keyof CacheSettingsFormValues, raw: string) {
    setValues((prev) => ({ ...prev, [key]: Number(raw) }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const result = cacheSettingsSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: CacheSettingsFormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CacheSettingsFormValues | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    onSave({ cache: result.data });
  }

  return (
    <SettingsSection
      title="Cache"
      icon={Database}
      description="TTLs for the permission and stats caches."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="permissionTtlMs">Permission cache TTL (ms)</Label>
          <Input
            id="permissionTtlMs"
            type="number"
            value={values.permissionTtlMs}
            onChange={(event) => setField('permissionTtlMs', event.target.value)}
            aria-invalid={!!errors.permissionTtlMs}
          />
          {errors.permissionTtlMs && (
            <p className="text-body text-error">{errors.permissionTtlMs}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="statsTtlMs">Stats cache TTL (ms)</Label>
          <Input
            id="statsTtlMs"
            type="number"
            value={values.statsTtlMs}
            onChange={(event) => setField('statsTtlMs', event.target.value)}
            aria-invalid={!!errors.statsTtlMs}
          />
          {errors.statsTtlMs && <p className="text-body text-error">{errors.statsTtlMs}</p>}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
          <p className="text-overline text-text-faint uppercase">Environment-only</p>
          <div className="flex items-center justify-between gap-3 text-body">
            <span className="text-text-muted">Project auth cache TTL</span>
            <span className="font-mono text-code text-text-normal">
              {settings.projectAuthTtlMs.value.toLocaleString()} ms
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-body">
            <span className="text-text-muted">Project access cache TTL</span>
            <span className="font-mono text-code text-text-normal">
              {settings.projectAccessTtlMs.value.toLocaleString()} ms
            </span>
          </div>
        </div>

        <Button type="submit" size="sm" className="self-start" disabled={isSaving || !isDirty}>
          Save
        </Button>
      </form>
    </SettingsSection>
  );
}

export { CacheSettings, type CacheSettingsProps };
