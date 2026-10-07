import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import { WebhookView } from '@/app/dashboard/projects/[id]/inbound-webhooks/[webhookId]/webhook-view';
import { InboundWebhooksView } from '@/app/dashboard/projects/[id]/inbound-webhooks/inbound-webhooks-view';
import { DefaultReadersSettings } from '@/features/inbound-webhooks/components/default-readers-settings';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back: vi.fn() }),
  usePathname: () => '/',
}));

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

const webhook = {
  id: WEBHOOK_ID,
  projectId: 'proj_1',
  name: 'Contact form',
  slug: 'contact-form',
  schema: { version: 1, steps: [] },
  acceptedOrigins: [],
  requireSignature: true,
  rejectUnknownFields: true,
  allowRoleInheritance: false,
  isActive: true,
  submissionCount: 2,
  lastSubmissionAt: null,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

const settings = {
  defaultReaderRoleIds: [EXECUTIVE],
  defaultReaderRoles: [
    { id: EXECUTIVE, name: 'MC Executive', serverId: 'srv-main', serverName: 'Main' },
  ],
  source: 'environment',
  updatedAt: null,
  updatedBy: null,
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  server.use(
    http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () => HttpResponse.json(webhook)),
    http.get(`${API_URL}/inbound-webhooks/${WEBHOOK_ID}/submissions`, ({ request }) => {
      const offset = Number(new URL(request.url).searchParams.get('offset'));
      return HttpResponse.json({ submissions: [], total: 0, limit: 200, offset });
    }),
    http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/roles`, () => HttpResponse.json([])),
    http.post(`${API_URL}/admin/inbound-webhooks/schema/preview`, () =>
      HttpResponse.json({
        ok: true,
        markdown: '',
        examplePayload: {},
      })
    ),
    http.get(`${API_URL}/admin/inbound-webhooks`, () => HttpResponse.json([])),
    http.get(`${API_URL}/admin/inbound-webhooks/settings`, () => HttpResponse.json(settings)),
    http.get(`${API_URL}/admin/projects/access/matrix`, () => HttpResponse.json([])),
    http.get(`${API_URL}/servers`, () => HttpResponse.json([])),
    http.get(`${API_URL}/admin/stats/roles`, () =>
      HttpResponse.json({ serverId: 'srv-main', serverName: 'Main', scope: 'server', roles: [] })
    )
  );
});

function renderWebhook() {
  return render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
}

function renderList() {
  return render(<InboundWebhooksView projectId="proj_1" />, { wrapper });
}

function renderDefaultReaders() {
  return render(<DefaultReadersSettings />, { wrapper });
}

describe('Inbound webhook access', () => {
  it('shows a read-only member no write or manage action on a webhook', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'read' } });
    renderWebhook();
    await screen.findByRole('heading', { name: 'Contact form' });

    expect(screen.queryByRole('switch', { name: 'Active' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Schema' }));
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.queryByRole('button', { name: 'Rotate secret' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete webhook' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });

  it('keeps the Submissions tab for a read-only member', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'read' } });
    renderWebhook();
    expect(await screen.findByRole('tab', { name: 'Submissions' })).toBeInTheDocument();
  });

  it('lets a writer rotate the secret but not delete', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'write' } });
    renderWebhook();
    await screen.findByRole('heading', { name: 'Contact form' });
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));

    expect(screen.getByRole('button', { name: 'Rotate secret' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete webhook' })).not.toBeInTheDocument();
  });

  it('lets a manager delete', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'manage' } });
    renderWebhook();
    await screen.findByRole('heading', { name: 'Contact form' });
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(screen.getByRole('button', { name: 'Delete webhook' })).toBeInTheDocument();
  });

  it('hides "New inbound webhook" without write', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'read' } });
    renderList();
    await screen.findByRole('heading', { name: 'Inbound webhooks' });
    expect(screen.queryByRole('link', { name: /new inbound webhook/i })).not.toBeInTheDocument();
  });

  it('shows the default readers read-only without write or without the role picker data', async () => {
    signInAs({ permissions: { inbound_webhooks: 'write' } });
    renderDefaultReaders();
    await screen.findByText(/these come from the server configuration|default readers/i);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
