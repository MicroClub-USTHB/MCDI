'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { INBOUND_WEBHOOK_TEMPLATES } from '@mcid/contracts';

import { isValidSlug, slugify, toCreatePayload } from '@/features/inbound-webhooks/api/mappers';
import { useCreateInboundWebhookMutation } from '@/features/inbound-webhooks/api/mutations';
import { useProjectRoleOptions } from '@/features/inbound-webhooks/api/queries';
import { PreviewPane } from '@/features/inbound-webhooks/components/preview-pane';
import { RolePicker } from '@/features/inbound-webhooks/components/role-picker';
import { useSchemaPreview } from '@/features/inbound-webhooks/components/use-schema-preview';
import { SigningSecretDialog } from '@/features/inbound-webhooks/components/signing-secret-dialog';
import { parseDocument } from '@/features/inbound-webhooks/schema/json-tree';
import { findFileWarnings } from '@/features/inbound-webhooks/schema/problems';
import type { CreateInboundWebhookResponse } from '@/features/inbound-webhooks/types';
import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';
import { McSwitch } from '@/shared/components/ui/mc-switch';
import { McTextarea } from '@/shared/components/ui/mc-textarea';
import { useCan } from '@/shared/lib/use-access';
import { showToast } from '@/shared/stores';

const SchemaEditor = dynamic(
  () =>
    import('@/features/inbound-webhooks/components/schema-editor').then(
      (module) => module.SchemaEditor
    ),
  {
    ssr: false,
    loading: () => <div className="h-96 rounded-lg border border-border bg-background" />,
  }
);

const BLANK = INBOUND_WEBHOOK_TEMPLATES.find((template) => template.id === 'blank');
const stringify = (schema: Record<string, unknown>) => JSON.stringify(schema, null, 2);

export function CreateWebhookForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const create = useCreateInboundWebhookMutation();
  const roles = useProjectRoleOptions(projectId);
  // The role list comes from the statistics; without it only the default readers can be used.
  const canListRoles = useCan('stats', 'read');

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
  const { schema, preview, serverProblems } = useSchemaPreview(text, name);
  const hasFileWarning = useMemo(() => findFileWarnings(parseDocument(text)).length > 0, [text]);

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
        <McInput
          id="webhook-name"
          label="Name"
          value={name}
          onChange={(event) => changeName(event.target.value)}
          maxLength={255}
          placeholder="Recruitment 2026"
        />
        <McInput
          id="webhook-slug"
          label="Slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
          error={
            slugProblem
              ? 'Use lowercase letters, digits and dashes, 2 to 64 characters, with no dash at either end.'
              : undefined
          }
          placeholder="recruitment-2026"
        />
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="paragraph-sm font-semibold text-foreground">Schema</h2>
          <p className="paragraph-sm text-muted-foreground">
            What callers send, as JSON. Use steps for a multi-step form, or list fields directly for
            an event or any other payload. Start from a template or write your own.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Templates">
          {INBOUND_WEBHOOK_TEMPLATES.map((template) => (
            <McButton
              key={template.id}
              type="button"
              variant="secondary"
              size="sm"
              title={template.description}
              onClick={() => setText(stringify(template.schema))}
            >
              {template.label}
            </McButton>
          ))}
        </div>
        {hasFileWarning ? (
          <div role="status" className="flex items-start gap-3 rounded-md bg-warning/12 p-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <p className="paragraph-sm text-warning">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="paragraph-sm font-semibold text-foreground">
              Who can read what it receives
            </h2>
            <p className="paragraph-sm text-muted-foreground">
              Members holding one of these Discord roles. The default roles are added for you;
              remove any you don&apos;t want here.
            </p>
          </div>
          <RolePicker
            options={roles.options}
            selected={selectedRoles}
            onChange={setPickedRoles}
            isLoading={roles.isLoading}
            unavailable={
              canListRoles
                ? undefined
                : 'Listing roles needs access to Statistics, so the default readers are used.'
            }
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="paragraph-sm font-semibold text-foreground">Options</h2>
          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="require-signature"
              className="flex flex-col gap-1 text-sm font-medium text-foreground"
            >
              Require a signature
              <span className="font-normal text-muted-foreground">
                Reject requests that aren&apos;t signed.
              </span>
            </label>
            <McSwitch
              id="require-signature"
              checked={requireSignature}
              onCheckedChange={setRequireSignature}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <label
              htmlFor="reject-unknown"
              className="flex flex-col gap-1 text-sm font-medium text-foreground"
            >
              Reject unknown fields
              <span className="font-normal text-muted-foreground">
                Off means fields outside the schema are dropped instead.
              </span>
            </label>
            <McSwitch
              id="reject-unknown"
              checked={rejectUnknownFields}
              onCheckedChange={setRejectUnknownFields}
            />
          </div>
          <McTextarea
            id="accepted-origins"
            label="Accepted origins"
            description="One per line. Leave empty to accept requests from anywhere."
            value={origins}
            onChange={(event) => setOrigins(event.target.value)}
            placeholder="https://app.microclub.dz"
            rows={3}
          />
        </section>
      </div>

      <div className="flex justify-end gap-3">
        <McButton type="button" variant="tertiary" onClick={() => router.back()}>
          Cancel
        </McButton>
        <McButton type="submit" disabled={!canSubmit}>
          {create.isPending ? 'Creating…' : 'Create webhook'}
        </McButton>
      </div>

      <SigningSecretDialog
        secret={created?.signingSecret ?? null}
        description={`${created?.webhook.name ?? 'The webhook'} is ready. Callers sign every request with this secret.`}
        submitUrl={created?.submitUrl ?? ''}
        onDone={() =>
          router.push(`/dashboard/projects/${encodeURIComponent(projectId)}/inbound-webhooks`)
        }
      />
    </form>
  );
}
