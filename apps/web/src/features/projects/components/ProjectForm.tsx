'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { INBOUND_WEBHOOK_TEMPLATES } from '@mcdi/contracts';

import { isValidSlug, slugify } from '@/features/inbound-webhooks/api/mappers';
import { useServersQuery } from '@/features/servers';
import { ScopeSelector } from '@/features/projects/components/ScopeSelector';
import type { ProjectView } from '@/features/projects/api/mappers';
import type { ProjectFormValues, ProjectScope } from '@/features/projects/types';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';

interface ProjectFormProps {
  /** Present in edit mode to seed the fields; null in create mode. */
  project?: ProjectView | null;
  mode: 'create' | 'edit';
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit: (values: ProjectFormValues) => void;
}

interface FormErrors {
  name?: string;
  description?: string;
  scopes?: string;
  webhookName?: string;
  webhookSlug?: string;
}

function validateName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Project name is required';
  if (trimmed.length < 3) return 'Project name must be at least 3 characters';
  if (trimmed.length > 50) return 'Project name must be 50 characters or fewer';
  return undefined;
}

function ProjectForm({
  project,
  mode,
  isSubmitting = false,
  submitLabel,
  onSubmit,
}: ProjectFormProps) {
  const { data: servers = [], isLoading: serversLoading } = useServersQuery();

  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [isInternal, setIsInternal] = useState(project?.isInternal ?? false);
  const [scopes, setScopes] = useState<ProjectScope[]>(['read_members']);
  const [serverIds, setServerIds] = useState<string[]>([]);
  const [enableWebhook, setEnableWebhook] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [webhookSlug, setWebhookSlug] = useState('');
  const [webhookSlugEdited, setWebhookSlugEdited] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank');
  const [webhookOrigins, setWebhookOrigins] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  function toggleServer(serverId: string) {
    setServerIds((current) =>
      current.includes(serverId) ? current.filter((id) => id !== serverId) : [...current, serverId]
    );
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!webhookSlugEdited && enableWebhook && webhookName.trim() === '') {
      setWebhookSlug(slugify(value));
    }
  }

  function toggleWebhook(enabled: boolean) {
    setEnableWebhook(enabled);
    if (enabled && webhookName.trim() === '' && name.trim() !== '') {
      const suggested = `${name.trim()} Webhook`;
      setWebhookName(suggested);
      if (!webhookSlugEdited) {
        setWebhookSlug(slugify(suggested));
      }
    }
  }

  function handleWebhookNameChange(value: string) {
    setWebhookName(value);
    if (!webhookSlugEdited) {
      setWebhookSlug(slugify(value));
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors: FormErrors = {
      name: validateName(name),
      description:
        description.length > 500 ? 'Description must be 500 characters or fewer' : undefined,
      scopes: mode === 'create' && scopes.length === 0 ? 'Select at least one scope' : undefined,
      webhookName:
        mode === 'create' && enableWebhook && webhookName.trim().length === 0
          ? 'Webhook name is required'
          : undefined,
      webhookSlug:
        mode === 'create' &&
        enableWebhook &&
        webhookSlug.trim() !== '' &&
        !isValidSlug(webhookSlug.trim())
          ? 'Use lowercase letters, digits and dashes (2-64 chars)'
          : undefined,
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some((error) => error !== undefined)) return;

    const selectedTemplate =
      INBOUND_WEBHOOK_TEMPLATES.find((t) => t.id === selectedTemplateId) ??
      INBOUND_WEBHOOK_TEMPLATES[0]!;

    onSubmit({
      name: name.trim(),
      description: description.trim(),
      isInternal,
      scopes,
      serverIds,
      ...(mode === 'create' && enableWebhook
        ? {
            inboundWebhook: {
              enabled: true,
              name: webhookName.trim(),
              slug: webhookSlug.trim() !== '' ? webhookSlug.trim() : undefined,
              schema: selectedTemplate.schema,
              origins: webhookOrigins.trim(),
            },
          }
        : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`project-name-${mode}`}>Project name</Label>
        <Input
          id={`project-name-${mode}`}
          value={name}
          onChange={(event) => handleNameChange(event.target.value)}
          aria-invalid={errors.name ? true : undefined}
          placeholder="e.g. MicroClub Website"
          maxLength={50}
        />
        {errors.name && <p className="text-overline text-error">{errors.name}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`project-description-${mode}`}>Description</Label>
        <Textarea
          id={`project-description-${mode}`}
          value={description}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)}
          aria-invalid={errors.description ? true : undefined}
          placeholder="What does this application do? (optional)"
          maxLength={500}
        />
        {errors.description && <p className="text-overline text-error">{errors.description}</p>}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-main p-3">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={`internal-${mode}`} className="text-body text-text-normal">
            Internal project
          </Label>
          <span className="text-overline text-text-subtle">
            Internal projects automatically get access to the main server.
          </span>
        </div>
        <Switch
          id={`internal-${mode}`}
          checked={isInternal}
          onCheckedChange={setIsInternal}
          disabled={isSubmitting}
        />
      </div>

      {mode === 'create' && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-body font-medium text-text-normal">Scopes</span>
            <ScopeSelector selected={scopes} onChange={setScopes} disabled={isSubmitting} />
            {errors.scopes && <p className="text-overline text-error">{errors.scopes}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-body font-medium text-text-normal">Server access</span>
              <span className="text-overline text-text-subtle">{serverIds.length} selected</span>
            </div>
            {serversLoading ? (
              <div className="rounded-md border border-border p-4 text-overline text-text-faint">
                Loading servers…
              </div>
            ) : servers.length === 0 ? (
              <div className="rounded-md border border-border p-4 text-body text-text-muted">
                No servers available.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {servers.map((server) => {
                  const checked = serverIds.includes(server.id);
                  return (
                    <Label
                      key={server.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface-main p-3 transition-colors select-none hover:bg-surface-hover"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleServer(server.id)}
                        disabled={!server.isActive || isSubmitting}
                        aria-label={`Grant access to ${server.name}`}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-body text-text-normal">{server.name}</span>
                        {!server.isActive && (
                          <span className="text-overline text-text-faint">Inactive server</span>
                        )}
                      </span>
                    </Label>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {mode === 'create' && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-main p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`webhook-enable-${mode}`} className="text-body text-text-normal">
                Inbound webhook
              </Label>
              <span className="text-overline text-text-subtle">
                Provision a form webhook and signing secret alongside this project.
              </span>
            </div>
            <Switch
              id={`webhook-enable-${mode}`}
              checked={enableWebhook}
              onCheckedChange={toggleWebhook}
              disabled={isSubmitting}
            />
          </div>

          {enableWebhook && (
            <div className="mt-2 flex flex-col gap-4 border-t border-border pt-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-name">Webhook name</Label>
                <Input
                  id="webhook-name"
                  value={webhookName}
                  onChange={(event) => handleWebhookNameChange(event.target.value)}
                  aria-invalid={errors.webhookName ? true : undefined}
                  placeholder="e.g. Submissions Webhook"
                  maxLength={100}
                />
                {errors.webhookName && (
                  <p className="text-overline text-error">{errors.webhookName}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-slug">Webhook slug (optional)</Label>
                <Input
                  id="webhook-slug"
                  value={webhookSlug}
                  onChange={(event) => {
                    setWebhookSlugEdited(true);
                    setWebhookSlug(event.target.value);
                  }}
                  aria-invalid={errors.webhookSlug ? true : undefined}
                  placeholder="e.g. submissions"
                  maxLength={64}
                />
                {errors.webhookSlug && (
                  <p className="text-overline text-error">{errors.webhookSlug}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body font-medium text-text-normal">Schema template</span>
                  <span className="text-overline text-text-subtle">
                    Choose a starter form schema for this webhook.
                  </span>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Schema templates">
                  {INBOUND_WEBHOOK_TEMPLATES.map((template) => {
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <Button
                        key={template.id}
                        type="button"
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        title={template.description}
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        {template.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-origins">Accepted origins (optional)</Label>
                <Textarea
                  id="webhook-origins"
                  value={webhookOrigins}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    setWebhookOrigins(event.target.value)
                  }
                  placeholder="https://app.microclub.dz (one per line, leave empty for any)"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <Button type="submit" size="md" disabled={isSubmitting} className="self-end">
        {isSubmitting
          ? 'Saving…'
          : (submitLabel ?? (mode === 'create' ? 'Create project' : 'Save changes'))}
      </Button>
    </form>
  );
}

export { ProjectForm, type ProjectFormProps };
