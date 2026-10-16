'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
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
  /** Read-only: disables the form and replaces Save with a badge. */
  readOnly?: boolean;
}

function PreferencesSettings({
  preferences,
  onSave,
  isSaving = false,
  readOnly = false,
}: PreferencesSettingsProps) {
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
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 border-0 p-0">
          <McInput
            id="memberActivityThresholdDays"
            label="Member activity threshold (days)"
            type="number"
            value={values.memberActivityThresholdDays}
            onChange={(event) =>
              setValues({ memberActivityThresholdDays: Number(event.target.value) })
            }
            error={errors.memberActivityThresholdDays}
          />

          {readOnly ? (
            <McBadge variant="outline" size="md" className="self-start">
              Read only
            </McBadge>
          ) : (
            <McButton
              type="submit"
              size="sm"
              className="self-start"
              disabled={isSaving || !isDirty}
            >
              Save
            </McButton>
          )}
        </fieldset>
      </form>
    </SettingsSection>
  );
}

export { PreferencesSettings, type PreferencesSettingsProps };
