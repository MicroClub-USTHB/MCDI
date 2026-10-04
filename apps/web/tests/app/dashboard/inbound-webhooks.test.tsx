import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { InboundWebhooksView } from '@/app/dashboard/projects/[id]/inbound-webhooks/inbound-webhooks-view';
import { CreateWebhookForm } from '@/features/inbound-webhooks/components/create-webhook-form';
import { DefaultReadersSettings } from '@/features/inbound-webhooks/components/default-readers-settings';
import { useToastStore } from '@/shared/stores/toast';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/features/inbound-webhooks/components/schema-editor', () => ({
  SchemaEditor: ({ value, onChange }: { value: string; onChange: (text: string) => void }) => (
    <textarea
      aria-label="Schema JSON"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const API_URL = 'http://localhost:3000/api';
const EXECUTIVE = '700000000000000001';
const MEMBER = '700000000000000003';

function webhook(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    projectId: 'proj_1',
    name,
    slug: name.toLowerCase(),
    schema: { version: 1, steps: [] },
    acceptedOrigins: [],
    requireSignature: true,
    rejectUnknownFields: true,
    allowRoleInheritance: false,
    isActive: true,
    submissionCount: 1204,
    lastSubmissionAt: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    ...overrides,
  };
}

const settings = {
  defaultReaderRoleIds: [EXECUTIVE],
  defaultReaderRoles: [
    { id: EXECUTIVE, name: 'MC Executive', serverId: 'srv-main', serverName: 'Main' },
  ],
  source: 'settings',
  updatedAt: null,
  updatedBy: null,
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function serveRoles() {
  server.use(
    http.get(`${API_URL}/admin/inbound-webhooks/settings`, () => HttpResponse.json(settings)),
    http.get(`${API_URL}/admin/projects/access/matrix`, () =>
      HttpResponse.json([{ projectId: 'proj_1', serverId: 'srv-events', serverName: 'Events' }])
    ),
    http.get(`${API_URL}/servers`, () =>
      HttpResponse.json([
        { id: 'srv-main', name: 'Main' },
        { id: 'srv-events', name: 'Events' },
      ])
    ),
    http.get(`${API_URL}/admin/stats/roles`, ({ request }) => {
      const serverId = new URL(request.url).searchParams.get('serverId');
      return HttpResponse.json(
        serverId === 'srv-main'
          ? {
              serverId,
              serverName: 'Main',
              scope: 'server',
              totalMembers: 10,
              roles: [{ roleId: EXECUTIVE, roleName: 'MC Executive', color: 0, memberCount: 3 }],
            }
          : {
              serverId,
              serverName: 'Events',
              scope: 'server',
              totalMembers: 10,
              roles: [{ roleId: MEMBER, roleName: 'Member', color: 0, memberCount: 9 }],
            }
      );
    })
  );
}

let previewBodies: unknown[] = [];
function servePreview() {
  previewBodies = [];
  server.use(
    http.post(`${API_URL}/admin/inbound-webhooks/schema/preview`, async ({ request }) => {
      previewBodies.push(await request.json());
      return HttpResponse.json({
        ok: true,
        markdown: '# Docs\n\n| Field | Type |\n| --- | --- |\n| `field1` | string |',
        examplePayload: { step1: { field1: 'example' } },
      });
    })
  );
}

beforeEach(() => push.mockClear());
afterEach(() => useToastStore.setState({ toasts: [] }));

describe('Inbound webhooks list', () => {
  it('lists the webhooks with their readers and counts', async () => {
    server.use(
      http.get(`${API_URL}/admin/inbound-webhooks`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('projectId')).toBe('proj_1');
        return HttpResponse.json([
          webhook('wh_1', 'Recruitment'),
          webhook('wh_2', 'Workshop', { requireSignature: false, isActive: false }),
        ]);
      }),
      http.get(`${API_URL}/admin/inbound-webhooks/wh_1/roles`, () =>
        HttpResponse.json([{ roleId: EXECUTIVE, roleName: 'MC Executive', serverId: 'srv-main' }])
      ),
      http.get(`${API_URL}/admin/inbound-webhooks/wh_2/roles`, () => HttpResponse.json([]))
    );

    render(<InboundWebhooksView projectId="proj_1" />, { wrapper });

    const row = (await screen.findByText('Recruitment')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Signed')).toBeInTheDocument();
    expect(within(row).getByText('1,204')).toBeInTheDocument();
    expect(await within(row).findByText('MC Executive')).toBeInTheDocument();
    const other = screen.getByText('Workshop').closest('tr') as HTMLElement;
    expect(within(other).getByText('Unsigned')).toBeInTheDocument();
    expect(within(other).getByText('Disabled')).toBeInTheDocument();
    expect(await within(other).findByText('None')).toBeInTheDocument();
  });

  it('offers to create the first one', async () => {
    server.use(http.get(`${API_URL}/admin/inbound-webhooks`, () => HttpResponse.json([])));

    render(<InboundWebhooksView projectId="proj_1" />, { wrapper });

    expect(await screen.findByText('No inbound webhooks')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /New inbound webhook/ })[0]).toHaveAttribute(
      'href',
      '/dashboard/projects/proj_1/inbound-webhooks/new'
    );
  });

  it('can be retried after a failure', async () => {
    server.use(
      http.get(`${API_URL}/admin/inbound-webhooks`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    render(<InboundWebhooksView projectId="proj_1" />, { wrapper });

    expect(await screen.findByText('Couldn’t load inbound webhooks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('Create inbound webhook', () => {
  it('starts from the blank template, the default reader, and a suggested slug', async () => {
    serveRoles();
    servePreview();

    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });

    const editor = (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement;
    expect(JSON.parse(editor.value)).toEqual(expect.objectContaining({ version: 1 }));
    expect(
      await within(await screen.findByRole('list', { name: 'Selected roles' })).findByText(
        'MC Executive'
      )
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'Recruitment 2026');
    expect(screen.getByLabelText('Slug')).toHaveValue('recruitment-2026');
  });

  it('replaces the schema with a template', async () => {
    serveRoles();
    servePreview();
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });

    await userEvent.click(screen.getByRole('button', { name: 'Event registration' }));

    const editor = (await screen.findByLabelText('Schema JSON')) as HTMLTextAreaElement;
    const text = editor.value;
    expect(text).toContain('./is_member');
  });

  it('shows the API preview of a valid schema, after a pause', async () => {
    serveRoles();
    servePreview();
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });

    expect(await screen.findByText(/"example"/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Docs' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Field' })).toBeInTheDocument();
    expect(previewBodies).toHaveLength(1);
  });

  it('keeps the last valid preview, without asking the API, while the text is not valid JSON', async () => {
    serveRoles();
    servePreview();
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });
    await screen.findByText(/"example"/);

    const editor = await screen.findByLabelText('Schema JSON');
    await userEvent.clear(editor);
    await userEvent.type(editor, '{{ "version": ');

    expect(await screen.findByText(/This is the last version that was valid/)).toBeInTheDocument();
    expect(screen.getByText(/"example"/)).toBeInTheDocument();
    expect(previewBodies).toHaveLength(1);
  });

  it('warns about a required file field', async () => {
    serveRoles();
    servePreview();
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });
    const schema = {
      version: 1,
      steps: [{ key: 's', fields: [{ key: 'cv', type: 'file', required: true }] }],
    };

    const editor = await screen.findByLabelText('Schema JSON');
    await userEvent.clear(editor);
    await userEvent.click(editor);
    await userEvent.paste(JSON.stringify(schema));

    expect(await screen.findByText(/File fields can.t be submitted yet/)).toBeInTheDocument();
  });

  it('will not submit without a reader role', async () => {
    serveRoles();
    servePreview();
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });
    await userEvent.type(screen.getByLabelText('Name'), 'Recruitment');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove MC Executive' }));

    expect(screen.getByRole('button', { name: 'Create webhook' })).toBeDisabled();
  });

  it('creates the webhook with exactly the chosen roles and shows the secret once', async () => {
    serveRoles();
    servePreview();
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_URL}/admin/inbound-webhooks`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          webhook: webhook('wh_9', 'Recruitment'),
          signingSecret: 'whsec_abc123',
          allowedRoleIds: [MEMBER],
          submitUrl: 'https://api.example.com/api/inbound/proj_1/recruitment',
          docsUrl: 'https://api.example.com/docs',
        });
      })
    );
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });

    await userEvent.type(screen.getByLabelText('Name'), 'Recruitment');
    await userEvent.click(await screen.findByRole('button', { name: 'Remove MC Executive' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Member' }));
    await userEvent.type(
      screen.getByLabelText('Accepted origins'),
      'https://a.dz{enter}https://a.dz'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create webhook' }));

    const dialog = await screen.findByRole('dialog');
    expect(sent).toMatchObject({
      projectId: 'proj_1',
      name: 'Recruitment',
      slug: 'recruitment',
      allowedRoleIds: [MEMBER],
      acceptedOrigins: ['https://a.dz'],
      requireSignature: true,
      rejectUnknownFields: true,
    });
    expect(within(dialog).getByLabelText('Signing secret')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: /saved the secret/ }));
    expect(push).toHaveBeenCalledWith('/dashboard/projects/proj_1/inbound-webhooks');
  });

  it('keeps the form and reports the failure when the API refuses', async () => {
    serveRoles();
    servePreview();
    server.use(
      http.post(`${API_URL}/admin/inbound-webhooks`, () =>
        HttpResponse.json({ message: 'slug already taken' }, { status: 409 })
      )
    );
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });
    await userEvent.type(screen.getByLabelText('Name'), 'Recruitment');
    await screen.findByRole('button', { name: 'Remove MC Executive' });

    await userEvent.click(screen.getByRole('button', { name: 'Create webhook' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'slug already taken'
      )
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Default readers settings', () => {
  it('saves a changed list', async () => {
    serveRoles();
    let sent: unknown = null;
    server.use(
      http.put(`${API_URL}/admin/inbound-webhooks/settings`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...settings, defaultReaderRoleIds: [EXECUTIVE, MEMBER] });
      })
    );
    render(<DefaultReadersSettings />, { wrapper });

    const save = await screen.findByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Member' }));
    expect(save).toBeEnabled();
    await userEvent.click(save);

    await waitFor(() => expect(sent).toEqual({ defaultReaderRoleIds: [EXECUTIVE, MEMBER] }));
    await waitFor(() => expect(save).toBeDisabled());
  });
});
