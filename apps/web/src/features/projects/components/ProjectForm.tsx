'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { INBOUND_WEBHOOK_TEMPLATES } from '@mcid/contracts';

import { isValidSlug, slugify } from '@/features/inbound-webhooks/api/mappers';
import { useServersQuery } from '@/features/servers';
import { ScopeSelector } from '@/features/projects/components/ScopeSelector';
import type { ProjectView } from '@/features/projects/api/mappers';
import type { ProjectFormValues, ProjectScope } from '@/features/projects/types';
import { McButton } from '@/shared/components/ui/mc-button';
import { McCheckbox } from '@/shared/components/ui/mc-checkbox';
import { McInput } from '@/shared/components/ui/mc-input';
import { McSwitch } from '@/shared/components/ui/mc-switch';
import { McTextarea } from '@/shared/components/ui/mc-textarea';
import { useCan } from '@/shared/lib/use-access';

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

  const canServers = useCan('servers', 'read');

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
      <McInput
        id={`project-name-${mode}`}
        label="Project name"
        value={name}
        onChange={(event) => handleNameChange(event.target.value)}
        error={errors.name}
        placeholder="e.g. Micro Club Website"
        maxLength={50}
      />

      <McTextarea
        id={`project-description-${mode}`}
        label="Description"
        value={description}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDescription(event.target.value)}
        error={errors.description}
        placeholder="What does this application do? (optional)"
        maxLength={500}
      />

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor={`internal-${mode}`}
            id={`internal-${mode}-label`}
            className="paragraph-sm font-medium text-foreground"
          >
            Internal project
          </label>
          <span className="paragraph-xs text-muted-foreground">
            Internal projects automatically get access to the main server.
          </span>
        </div>
        <McSwitch
          id={`internal-${mode}`}
          aria-labelledby={`internal-${mode}-label`}
          checked={isInternal}
          onCheckedChange={(checked) => setIsInternal(checked)}
          disabled={isSubmitting}
        />
      </div>

      {mode === 'create' && (
        <>
          <div className="flex flex-col gap-2">
            <span className="paragraph-sm font-medium text-foreground">Scopes</span>
            <ScopeSelector selected={scopes} onChange={setScopes} disabled={isSubmitting} />
            {errors.scopes && (
              <p role="alert" className="text-sm text-destructive">
                {errors.scopes}
              </p>
            )}
          </div>

          {canServers ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="paragraph-sm font-medium text-foreground">Server access</span>
                <span className="paragraph-xs text-muted-foreground">
                  {serverIds.length} selected
                </span>
              </div>
              {serversLoading ? (
                <div className="rounded-lg border border-border p-4 paragraph-xs text-muted-foreground">
                  Loading servers…
                </div>
              ) : servers.length === 0 ? (
                <div className="rounded-lg border border-border p-4 paragraph-sm text-muted-foreground">
                  No servers available.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {servers.map((server) => {
                    const checked = serverIds.includes(server.id);
                    return (
                      <div
                        key={server.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors select-none hover:bg-muted"
                      >
                        <McCheckbox
                          id={`project-server-${mode}-${server.id}`}
                          checked={checked}
                          onCheckedChange={() => toggleServer(server.id)}
                          disabled={!server.isActive || isSubmitting}
                          aria-label={`Grant access to ${server.name}`}
                        />
                        <label
                          htmlFor={`project-server-${mode}-${server.id}`}
                          className="flex flex-1 cursor-pointer flex-col gap-0.5"
                        >
                          <span className="paragraph-sm text-foreground">{server.name}</span>
                          {!server.isActive && (
                            <span className="paragraph-xs text-muted-foreground">
                              Inactive server
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {mode === 'create' && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label
                htmlFor={`webhook-enable-${mode}`}
                id={`webhook-enable-${mode}-label`}
                className="paragraph-sm font-medium text-foreground"
              >
                Inbound webhook
              </label>
              <span className="paragraph-xs text-muted-foreground">
                Provision a form webhook and signing secret alongside this project.
              </span>
            </div>
            <McSwitch
              id={`webhook-enable-${mode}`}
              aria-labelledby={`webhook-enable-${mode}-label`}
              checked={enableWebhook}
              onCheckedChange={(checked) => toggleWebhook(checked)}
              disabled={isSubmitting}
            />
          </div>

          {enableWebhook && (
            <div className="mt-2 flex flex-col gap-4 border-t border-border pt-3">
              <McInput
                id="webhook-name"
                label="Webhook name"
                value={webhookName}
                onChange={(event) => handleWebhookNameChange(event.target.value)}
                error={errors.webhookName}
                placeholder="e.g. Submissions Webhook"
                maxLength={100}
              />

              <McInput
                id="webhook-slug"
                label="Webhook slug (optional)"
                value={webhookSlug}
                onChange={(event) => {
                  setWebhookSlugEdited(true);
                  setWebhookSlug(event.target.value);
                }}
                error={errors.webhookSlug}
                placeholder="e.g. submissions"
                maxLength={64}
              />

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="paragraph-sm font-medium text-foreground">Schema template</span>
                  <span className="paragraph-xs text-muted-foreground">
                    Choose a starter form schema for this webhook.
                  </span>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Schema templates">
                  {INBOUND_WEBHOOK_TEMPLATES.map((template) => {
                    const isSelected = selectedTemplateId === template.id;
                    return (
                      <McButton
                        key={template.id}
                        type="button"
                        variant={isSelected ? 'primary' : 'secondary'}
                        size="sm"
                        title={template.description}
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        {template.label}
                      </McButton>
                    );
                  })}
                </div>
              </div>

              <McTextarea
                id="webhook-origins"
                label="Accepted origins (optional)"
                value={webhookOrigins}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setWebhookOrigins(event.target.value)
                }
                placeholder="https://app.microclub.dz (one per line, leave empty for any)"
                rows={2}
              />
            </div>
          )}
        </div>
      )}

      <McButton type="submit" size="md" disabled={isSubmitting} className="self-end">
        {isSubmitting
          ? 'Saving…'
          : (submitLabel ?? (mode === 'create' ? 'Create project' : 'Save changes'))}
      </McButton>
    </form>
  );
}

export { ProjectForm, type ProjectFormProps };
