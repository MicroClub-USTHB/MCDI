'use client';

import { useState } from 'react';
import { Gauge } from 'lucide-react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import { SettingsSection } from '@/features/settings/components/SettingsSection';
import {
  rateLimitSettingsSchema,
  type RateLimitSettingsFormErrors,
  type RateLimitSettingsFormValues,
} from '@/features/settings/components/settings-forms.schema';
import type { RateLimitSettingsGroup, UpdateSettingsPayload } from '@/features/settings/types';

interface RateLimitSettingsProps {
  limits: RateLimitSettingsGroup;
  onSave: (payload: UpdateSettingsPayload) => void;
  isSaving?: boolean;
  /** Read-only: disables the form and replaces Save with a badge. */
  readOnly?: boolean;
}

function RateLimitSettings({
  limits,
  onSave,
  isSaving = false,
  readOnly = false,
}: RateLimitSettingsProps) {
  const [values, setValues] = useState<RateLimitSettingsFormValues>({
    maxWebhooksPerProject: limits.maxWebhooksPerProject.value,
  });
  const [errors, setErrors] = useState<RateLimitSettingsFormErrors>({});
  const isDirty = values.maxWebhooksPerProject !== limits.maxWebhooksPerProject.value;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const result = rateLimitSettingsSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: RateLimitSettingsFormErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof RateLimitSettingsFormValues | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    onSave({ rateLimit: result.data });
  }

  return (
    <SettingsSection
      title="Rate limits"
      icon={Gauge}
      description="API throttling and per-project resource caps."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-4 border-0 p-0">
          <McInput
            id="maxWebhooksPerProject"
            label="Max webhooks per project"
            type="number"
            value={values.maxWebhooksPerProject}
            onChange={(event) => setValues({ maxWebhooksPerProject: Number(event.target.value) })}
            error={errors.maxWebhooksPerProject}
          />

          <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
            <p className="paragraph-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Environment-only
            </p>
            <div className="flex items-center justify-between gap-3 paragraph-sm">
              <span className="text-muted-foreground">Global rate limit window</span>
              <span className="font-mono text-xs text-foreground">
                {limits.globalTtlMs.value.toLocaleString()} ms
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 paragraph-sm">
              <span className="text-muted-foreground">Global rate limit</span>
              <span className="font-mono text-xs text-foreground">
                {limits.globalLimit.value.toLocaleString()} req/window
              </span>
            </div>
          </div>

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

export { RateLimitSettings, type RateLimitSettingsProps };
