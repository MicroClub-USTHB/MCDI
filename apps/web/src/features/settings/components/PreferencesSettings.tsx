'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import {
  preferencesSettingsSchema,
  type PreferencesSettingsFormErrors,
  type PreferencesSettingsFormValues,
} from '@/features/settings/components/settings-forms.schema';
import type { PreferencesSettingsGroup, UpdateSettingsPayload } from '@/features/settings/types';

interface PreferencesSettingsProps {
  preferences: PreferencesSettingsGroup;
  onSave: (payload: UpdateSettingsPayload) => void;
  isSaving?: boolean;
}

function PreferencesSettings({ preferences, onSave, isSaving = false }: PreferencesSettingsProps) {
  const [values, setValues] = useState<PreferencesSettingsFormValues>({
    memberActivityThresholdDays: preferences.memberActivityThresholdDays.value,
  });
  const [errors, setErrors] = useState<PreferencesSettingsFormErrors>({});
  const isDirty =
    values.memberActivityThresholdDays !== preferences.memberActivityThresholdDays.value;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const result = preferencesSettingsSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: PreferencesSettingsFormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PreferencesSettingsFormValues | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    onSave({ preferences: result.data });
  }

  return (
    <SettingsSection
      title="Preferences"
      icon={SlidersHorizontal}
      description="Behavior knobs that don't fit cache or rate limiting."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="memberActivityThresholdDays">Member activity threshold (days)</Label>
          <Input
            id="memberActivityThresholdDays"
            type="number"
            value={values.memberActivityThresholdDays}
            onChange={(event) =>
              setValues({ memberActivityThresholdDays: Number(event.target.value) })
            }
            aria-invalid={!!errors.memberActivityThresholdDays}
          />
          {errors.memberActivityThresholdDays && (
            <p className="text-body text-error">{errors.memberActivityThresholdDays}</p>
          )}
        </div>

        <Button type="submit" size="sm" className="self-start" disabled={isSaving || !isDirty}>
          Save
        </Button>
      </form>
    </SettingsSection>
  );
}

export { PreferencesSettings, type PreferencesSettingsProps };
