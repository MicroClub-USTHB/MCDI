'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { INBOUND_WEBHOOK_TEMPLATES } from '@mcdi/contracts';

import { isValidSlug, slugify, toCreatePayload } from '@/features/inbound-webhooks/api/mappers';
import { useCreateInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import {
  useProjectRoleOptions,
  useSchemaPreviewQuery,
} from '@/features/inbound-webhooks/api/queries';
import { PreviewPane } from '@/features/inbound-webhooks/components/preview-pane';
import { RolePicker } from '@/features/inbound-webhooks/components/role-picker';
import { SigningSecretDialog } from '@/features/inbound-webhooks/components/signing-secret-dialog';
import { parseDocument } from '@/features/inbound-webhooks/schema/json-tree';
import { findFileWarnings } from '@/features/inbound-webhooks/schema/problems';
import type { CreateInboundWebhookResponse } from '@/features/inbound-webhooks/types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Textarea } from '@/shared/components/ui/textarea';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { useToastStore } from '@/shared/stores/toast';

const SchemaEditor = dynamic(
  () =>
    import('@/features/inbound-webhooks/components/schema-editor').then(
      (module) => module.SchemaEditor
    ),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-md border border-border bg-surface-base" />,
  }
);

const PREVIEW_DELAY_MS = 600;
const BLANK = INBOUND_WEBHOOK_TEMPLATES.find((template) => template.id === 'blank');
const stringify = (schema: Record<string, unknown>) => JSON.stringify(schema, null, 2);

function parseSchema(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function CreateWebhookForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const showToast = useToastStore((state) => state.show);
  const create = useCreateInboundWebhookMutation();
  const roles = useProjectRoleOptions(projectId);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [text, setText] = useState(BLANK ? stringify(BLANK.schema) : '{}');
  const [pickedRoles, setPickedRoles] = useState<string[] | null>(null);
  const [origins, setOrigins] = useState('');
  const [requireSignature, setRequireSignature] = useState(true);
  const [rejectUnknownFields, setRejectUnknownFields] = useState(true);
  const [created, setCreated] = useState<CreateInboundWebhookResponse | null>(null);

  const selectedRoles = pickedRoles ?? roles.defaultRoleIds;
  const schema = useMemo(() => parseSchema(text), [text]);
  const debouncedSchema = useDebouncedValue(schema, PREVIEW_DELAY_MS);
  const preview = useSchemaPreviewQuery(
    debouncedSchema ? { schema: debouncedSchema, name: name.trim() || undefined } : null
  );
  const hasFileWarning = useMemo(() => findFileWarnings(parseDocument(text)).length > 0, [text]);

  const serverProblems = preview.data && !preview.data.ok ? preview.data.errors : undefined;
  const slugProblem = slug !== '' && !isValidSlug(slug);
  const canSubmit =
    name.trim() !== '' &&
    isValidSlug(slug) &&
    schema !== null &&
    selectedRoles.length > 0 &&
    !create.isPending;

  function changeName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!schema || !canSubmit) return;
    create.mutate(
      toCreatePayload(projectId, {
        name,
        slug,
        schema,
        allowedRoleIds: selectedRoles,
        origins,
        requireSignature,
        rejectUnknownFields,
      }),
      {
        onSuccess: (response) => setCreated(response.data),
        onError: (error) => showToast(error.message || 'Failed to create the webhook', 'error'),
      }
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="webhook-name">Name</Label>
          <Input
            id="webhook-name"
            value={name}
            onChange={(event) => changeName(event.target.value)}
            maxLength={255}
            placeholder="Recruitment 2026"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="webhook-slug">Slug</Label>
          <Input
            id="webhook-slug"
            value={slug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            aria-invalid={slugProblem}
            placeholder="recruitment-2026"
          />
          {slugProblem ? (
            <p className="text-body text-error">
              Use lowercase letters, digits and dashes, 2 to 64 characters, with no dash at either
              end.
            </p>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-subhead text-text-primary">Schema</h2>
          <p className="text-body text-text-muted">
            What callers send, as JSON. Use steps for a multi-step form, or list fields directly for
            an event or any other payload. Start from a template or write your own.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Templates">
          {INBOUND_WEBHOOK_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              type="button"
              variant="secondary"
              size="sm"
              title={template.description}
              onClick={() => setText(stringify(template.schema))}
            >
              {template.label}
            </Button>
          ))}
        </div>
        {hasFileWarning ? (
          <div role="status" className="flex items-start gap-3 rounded-md bg-warning/12 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-body text-warning">
              File fields can&apos;t be submitted yet. A required one will reject every submission,
              so make it optional or leave it out.
            </p>
          </div>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-2">
          <SchemaEditor value={text} onChange={setText} serverProblems={serverProblems} />
          <PreviewPane
            preview={preview.data}
            waitingForJson={schema === null}
            isFetching={preview.isFetching}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-subhead text-text-primary">Who can read what it receives</h2>
          <p className="text-body text-text-muted">
            Members holding one of these Discord roles. The default roles are added for you; remove
            any you don&apos;t want here.
          </p>
        </div>
        <RolePicker
          options={roles.options}
          selected={selectedRoles}
          onChange={setPickedRoles}
          isLoading={roles.isLoading}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-subhead text-text-primary">Options</h2>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="require-signature" className="flex flex-col gap-1">
            Require a signature
            <span className="text-text-muted">Reject requests that aren&apos;t signed.</span>
          </Label>
          <Switch
            id="require-signature"
            checked={requireSignature}
            onCheckedChange={setRequireSignature}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="reject-unknown" className="flex flex-col gap-1">
            Reject unknown fields
            <span className="text-text-muted">
              Off means fields outside the schema are dropped instead.
            </span>
          </Label>
          <Switch
            id="reject-unknown"
            checked={rejectUnknownFields}
            onCheckedChange={setRejectUnknownFields}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accepted-origins">Accepted origins</Label>
          <Textarea
            id="accepted-origins"
            value={origins}
            onChange={(event) => setOrigins(event.target.value)}
            placeholder="https://app.microclub.dz"
            rows={3}
          />
          <p className="text-body text-text-muted">
            One per line. Leave empty to accept requests from anywhere.
          </p>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {create.isPending ? 'Creating…' : 'Create webhook'}
        </Button>
      </div>

      <SigningSecretDialog
        secret={created?.signingSecret ?? null}
        webhookName={created?.webhook.name ?? ''}
        submitUrl={created?.submitUrl ?? ''}
        onDone={() =>
          router.push(`/dashboard/projects/${encodeURIComponent(projectId)}/inbound-webhooks`)
        }
      />
    </form>
  );
}
