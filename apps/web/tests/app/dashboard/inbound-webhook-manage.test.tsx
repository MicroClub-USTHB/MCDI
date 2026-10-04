import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { WebhookView } from '@/app/dashboard/projects/[id]/inbound-webhooks/[webhookId]/webhook-view';
import { downloadTextFile } from '@/shared/lib/download';
import { useToastStore } from '@/shared/stores/toast';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/shared/lib/download', () => ({ downloadTextFile: vi.fn() }));

vi.mock('@/features/inbound-webhooks/components/schema-editor', () => ({
  SchemaEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string;
    onChange: (text: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="Schema JSON"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const API_URL = 'http://localhost:3000/api';
const WEBHOOK_ID = 'wh_1';
const EXECUTIVE = '700000000000000001';
const MEMBER = '700000000000000003';

const SCHEMA = {
  version: 1,
  steps: [
    {
      key: 'identity',
      fields: [
        { key: 'firstname', type: 'string', required: true },
        { key: 'email', type: 'email', required: true },
      ],
    },
  ],
};

function webhook(overrides: Record<string, unknown> = {}) {
  return {
    id: WEBHOOK_ID,
    projectId: 'proj_1',
    name: 'Recruitment',
    slug: 'recruitment',
    schema: SCHEMA,
    acceptedOrigins: [],
    requireSignature: true,
    rejectUnknownFields: true,
    allowRoleInheritance: false,
    isActive: true,
    submissionCount: 2,
    lastSubmissionAt: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

const row = (id: string, firstname: string) => ({
  id,
  payload: { identity: { firstname, email: `${firstname}@usthb.dz` } },
  receivedAt: '2026-10-04T10:00:00.000Z',
  origin: null,
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function serve(opts: { webhook?: Record<string, unknown>; rows?: unknown[]; total?: number } = {}) {
  const rows = opts.rows ?? [row('s1', 'Ada'), row('s2', 'Linus')];
  server.use(
    http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () =>
      HttpResponse.json(webhook(opts.webhook))
    ),
    http.get(`${API_URL}/inbound-webhooks/${WEBHOOK_ID}/submissions`, ({ request }) => {
      const offset = Number(new URL(request.url).searchParams.get('offset'));
      return HttpResponse.json({
        submissions: rows.slice(offset, offset + 200),
        total: opts.total ?? rows.length,
        limit: 200,
        offset,
      });
    })
  );
}

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  vi.mocked(downloadTextFile).mockClear();
});
afterEach(() => useToastStore.setState({ toasts: [] }));

describe('Export CSV', () => {
  it('downloads every submission as a CSV named after the webhook', async () => {
    serve();
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(downloadTextFile).toHaveBeenCalledTimes(1));
    const [filename, csv, mime] = vi.mocked(downloadTextFile).mock.calls[0]!;
    expect(filename).toMatch(/^recruitment-submissions-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mime).toBe('text/csv');
    expect(csv.split('\r\n')).toEqual([
      'id,receivedAt,identity.firstname,identity.email',
      's1,2026-10-04T10:00:00.000Z,Ada,Ada@usthb.dz',
      's2,2026-10-04T10:00:00.000Z,Linus,Linus@usthb.dz',
    ]);
  });

  it('is off while there is nothing to export', async () => {
    serve({ rows: [] });
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('No submissions yet');

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('shows progress, can be cancelled, and then saves nothing', async () => {
    serve();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(`${API_URL}/inbound-webhooks/${WEBHOOK_ID}/submissions`, async ({ request }) => {
        if (Number(new URL(request.url).searchParams.get('limit')) === 200) await gate;
        return HttpResponse.json({
          submissions: [row('s1', 'Ada'), row('s2', 'Linus')],
          total: 2,
          limit: 200,
          offset: 0,
        });
      })
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Exporting 0 of 2');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    release();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled());
    expect(downloadTextFile).not.toHaveBeenCalled();
  });

  it('reports a failed export', async () => {
    serve();
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('Ada');
    server.use(
      http.get(`${API_URL}/inbound-webhooks/${WEBHOOK_ID}/submissions`, () =>
        HttpResponse.json({ message: 'boom', error: 'Internal' }, { status: 500 })
      )
    );

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain('boom')
    );
    expect(downloadTextFile).not.toHaveBeenCalled();
  });
});

describe('Delete', () => {
  async function openDelete() {
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete webhook' }));
    return screen.findByRole('dialog');
  }

  it('asks for the slug, then deletes and goes back to the list', async () => {
    serve();
    let deleted = false;
    server.use(
      http.delete(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const dialog = await openDelete();
    const confirm = within(dialog).getByRole('button', { name: 'Delete webhook' });

    expect(dialog).toHaveTextContent('2 submissions');
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Type recruitment/), 'recruitment');
    await userEvent.click(confirm);

    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/dashboard/projects/proj_1/inbound-webhooks')
    );
  });

  it('does not delete on a wrong slug', async () => {
    serve();
    const dialog = await openDelete();

    await userEvent.type(within(dialog).getByLabelText(/Type recruitment/), 'recruit');

    expect(within(dialog).getByRole('button', { name: 'Delete webhook' })).toBeDisabled();
  });

  it('reports a refused delete and stays on the page', async () => {
    serve();
    server.use(
      http.delete(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () =>
        HttpResponse.json({ message: 'not allowed', error: 'Forbidden' }, { status: 403 })
      )
    );
    const dialog = await openDelete();
    await userEvent.type(within(dialog).getByLabelText(/Type recruitment/), 'recruitment');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete webhook' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain('not allowed')
    );
    expect(push).not.toHaveBeenCalled();
  });
});

describe('Rotate the signing secret', () => {
  it('asks first, then shows the new secret once', async () => {
    serve();
    let rotated = 0;
    server.use(
      http.post(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/rotate-secret`, () => {
        rotated += 1;
        return HttpResponse.json({ signingSecret: 'whsec_brandnew' });
      })
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

    await userEvent.click(screen.getByRole('button', { name: 'Rotate secret' }));
    const confirm = await screen.findByRole('dialog');
    expect(confirm).toHaveTextContent(/old one are refused/);
    expect(rotated).toBe(0);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Rotate secret' }));

    const shown = await screen.findByRole('textbox', { name: 'Signing secret' });
    expect(rotated).toBe(1);
    expect(shown).not.toHaveValue('whsec_brandnew');
    await userEvent.click(screen.getByRole('button', { name: 'Reveal value' }));
    expect(shown).toHaveValue('whsec_brandnew');
    await userEvent.click(screen.getByRole('button', { name: /saved the secret/ }));

    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Signing secret' })).toBeNull()
    );
    expect(screen.queryByDisplayValue('whsec_brandnew')).toBeNull();
  });

  it('keeps the secret as it is when the question is dismissed', async () => {
    serve();
    let rotated = 0;
    server.use(
      http.post(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/rotate-secret`, () => {
        rotated += 1;
        return HttpResponse.json({ signingSecret: 'whsec_x' });
      })
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

    await userEvent.click(screen.getByRole('button', { name: 'Rotate secret' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(rotated).toBe(0);
  });
});

describe('Readers', () => {
  function serveRoles(granted: { roleId: string; roleName: string }[]) {
    server.use(
      http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/roles`, () =>
        HttpResponse.json(granted.map((role) => ({ ...role, roleColor: 0, serverId: 's1' })))
      ),
      http.get(`${API_URL}/admin/inbound-webhooks/settings`, () =>
        HttpResponse.json({
          defaultReaderRoleIds: [EXECUTIVE],
          defaultReaderRoles: [
            { id: EXECUTIVE, name: 'MC Executive', serverId: 's0', serverName: 'Main' },
          ],
          source: 'settings',
          updatedAt: null,
          updatedBy: null,
        })
      ),
      http.get(`${API_URL}/admin/projects/access/matrix`, () =>
        HttpResponse.json([{ projectId: 'proj_1', serverId: 's1', serverName: 'Events' }])
      ),
      http.get(`${API_URL}/admin/stats/roles`, () =>
        HttpResponse.json({
          serverId: 's1',
          serverName: 'Events',
          scope: 'server',
          totalMembers: 5,
          roles: [{ roleId: MEMBER, roleName: 'Member', color: 0, memberCount: 3 }],
        })
      )
    );
  }

  async function openReaders() {
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Readers' }));
  }

  it('shows who can read now, including a role outside the picker', async () => {
    serve();
    serveRoles([{ roleId: EXECUTIVE, roleName: 'MC Executive' }]);
    await openReaders();

    const chips = await screen.findByRole('list', { name: 'Selected roles' });
    expect(chips).toHaveTextContent('MC Executive');
    expect(screen.getByRole('button', { name: 'Save readers' })).toBeDisabled();
  });

  it('replaces the readers with the chosen roles', async () => {
    serve();
    serveRoles([{ roleId: EXECUTIVE, roleName: 'MC Executive' }]);
    let sent: unknown = null;
    server.use(
      http.put(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/roles`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ roleIds: [EXECUTIVE, MEMBER] });
      })
    );
    await openReaders();

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Member' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save readers' }));

    await waitFor(() => expect(sent).toEqual({ roleIds: [EXECUTIVE, MEMBER] }));
  });

  it('will not save with nobody left', async () => {
    serve();
    serveRoles([{ roleId: EXECUTIVE, roleName: 'MC Executive' }]);
    await openReaders();

    await userEvent.click(await screen.findByRole('button', { name: 'Remove MC Executive' }));

    expect(screen.getByRole('button', { name: 'Save readers' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one role/i);
  });

  it('reports a refused save', async () => {
    serve();
    serveRoles([{ roleId: EXECUTIVE, roleName: 'MC Executive' }]);
    server.use(
      http.put(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/roles`, () =>
        HttpResponse.json({ message: 'role not allowed', error: 'Bad Request' }, { status: 400 })
      )
    );
    await openReaders();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Member' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save readers' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'role not allowed'
      )
    );
  });
});

describe('Schema', () => {
  const NEXT_SCHEMA = {
    version: 1,
    steps: [{ key: 'identity', fields: [{ key: 'firstname', type: 'string', required: false }] }],
  };

  let previewResult: unknown;
  let patched: unknown;
  function serveSchema(overrides: Record<string, unknown> = {}) {
    previewResult = { ok: true, markdown: '# Docs', examplePayload: {} };
    patched = null;
    serve({ webhook: overrides });
    server.use(
      http.post(`${API_URL}/admin/inbound-webhooks/schema/preview`, () =>
        HttpResponse.json(previewResult)
      ),
      http.patch(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(webhook({ ...overrides, schema: NEXT_SCHEMA }));
      })
    );
  }

  async function openSchema() {
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Schema' }));
    return screen.findByLabelText('Schema JSON') as Promise<HTMLTextAreaElement>;
  }

  async function writeSchema(editor: HTMLTextAreaElement, schema: unknown) {
    await userEvent.clear(editor);
    await userEvent.click(editor);
    await userEvent.paste(JSON.stringify(schema));
  }

  it('shows the stored schema read-only until Edit', async () => {
    serveSchema();
    const editor = await openSchema();

    expect(editor).toHaveAttribute('readonly');
    expect(JSON.parse(editor.value)).toEqual(SCHEMA);
    expect(screen.queryByRole('button', { name: 'Save schema' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByLabelText('Schema JSON')).not.toHaveAttribute('readonly');
  });

  it('saves only a changed schema the API has accepted, asking first when there are submissions', async () => {
    serveSchema();
    const editor = await openSchema();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const save = screen.getByRole('button', { name: 'Save schema' });
    expect(save).toBeDisabled();

    await writeSchema(
      (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement,
      NEXT_SCHEMA
    );
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    const confirm = await screen.findByRole('dialog');
    expect(confirm).toHaveTextContent(
      'Existing submissions are not re-checked; new submissions must match the new schema.'
    );
    expect(patched).toBeNull();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Save schema' }));

    await waitFor(() => expect(patched).toEqual({ schema: NEXT_SCHEMA }));
    expect(editor).toBeDefined();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument());
  });

  it('saves without asking when nothing has been submitted yet', async () => {
    serveSchema({ submissionCount: 0 });
    await openSchema();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await writeSchema(
      (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement,
      NEXT_SCHEMA
    );
    const save = screen.getByRole('button', { name: 'Save schema' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    await waitFor(() => expect(patched).toEqual({ schema: NEXT_SCHEMA }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('will not save while the API reports problems, or the JSON is broken', async () => {
    serveSchema();
    await openSchema();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    previewResult = { ok: false, errors: [{ path: 'steps[0]', code: 'X', message: 'bad' }] };

    await writeSchema(
      (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement,
      NEXT_SCHEMA
    );
    expect(await screen.findByText(/The schema has 1 problem/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save schema' })).toBeDisabled();

    const editor = (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement;
    await userEvent.click(editor);
    await userEvent.paste('{');
    expect(screen.getByRole('button', { name: 'Save schema' })).toBeDisabled();
  });

  it('puts the stored schema back on Cancel', async () => {
    serveSchema();
    await openSchema();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await writeSchema(
      (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement,
      NEXT_SCHEMA
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const editor = (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual(SCHEMA);
    expect(editor).toHaveAttribute('readonly');
  });

  it('reports a schema the API refuses at the last moment', async () => {
    serveSchema({ submissionCount: 0 });
    server.use(
      http.patch(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () =>
        HttpResponse.json({ message: 'schema refused', error: 'Bad Request' }, { status: 400 })
      )
    );
    await openSchema();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await writeSchema(
      (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement,
      NEXT_SCHEMA
    );
    const save = screen.getByRole('button', { name: 'Save schema' });
    await waitFor(() => expect(save).toBeEnabled());

    await userEvent.click(save);

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'schema refused'
      )
    );
    expect(screen.getByRole('button', { name: 'Save schema' })).toBeInTheDocument();
  });
});
