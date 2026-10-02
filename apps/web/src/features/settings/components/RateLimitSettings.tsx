'use client';

import { useState } from 'react';
import { Gauge } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
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
}

function RateLimitSettings({ limits, onSave, isSaving = false }: RateLimitSettingsProps) {
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxWebhooksPerProject">Max webhooks per project</Label>
          <Input
            id="maxWebhooksPerProject"
            type="number"
            value={values.maxWebhooksPerProject}
            onChange={(event) => setValues({ maxWebhooksPerProject: Number(event.target.value) })}
            aria-invalid={!!errors.maxWebhooksPerProject}
          />
          {errors.maxWebhooksPerProject && (
            <p className="text-body text-error">{errors.maxWebhooksPerProject}</p>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
          <p className="text-overline text-text-faint uppercase">Environment-only</p>
          <div className="flex items-center justify-between gap-3 text-body">
            <span className="text-text-muted">Global rate limit window</span>
            <span className="font-mono text-code text-text-normal">
              {limits.globalTtlMs.value.toLocaleString()} ms
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-body">
            <span className="text-text-muted">Global rate limit</span>
            <span className="font-mono text-code text-text-normal">
              {limits.globalLimit.value.toLocaleString()} req/window
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

export { RateLimitSettings, type RateLimitSettingsProps };
