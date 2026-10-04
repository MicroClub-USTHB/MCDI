import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { WebhookView } from '@/app/dashboard/projects/[id]/inbound-webhooks/[webhookId]/webhook-view';
import { useToastStore } from '@/shared/stores/toast';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}));

const API_URL = 'http://localhost:3000/api';
const WEBHOOK_ID = 'wh_1';

const STEPPED = {
  version: 1,
  steps: [
    {
      key: 'identity',
      fields: [
        { key: 'firstname', type: 'string', required: true },
        { key: 'email', type: 'email', required: true },
        { key: 'status', type: 'string', required: true },
        { key: 'phone', type: 'phone', required: false },
      ],
    },
  ],
};

const FLAT = {
  version: 1,
  fields: [
    { key: 'title', type: 'string', required: true },
    { key: 'online', type: 'boolean', required: true },
  ],
};

function webhook(overrides: Record<string, unknown> = {}) {
  return {
    id: WEBHOOK_ID,
    projectId: 'proj_1',
    name: 'Recruitment',
    slug: 'recruitment',
    schema: STEPPED,
    acceptedOrigins: ['https://a.dz'],
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

function submission(id: string, payload: Record<string, unknown>) {
  return { id, payload, receivedAt: '2026-10-04T10:00:00.000Z', origin: null };
}

const ADA = submission('s1', {
  identity: { firstname: 'Ada', email: 'ada@usthb.dz', status: 'student', phone: '0555' },
});
const LINUS = submission('s2', {
  identity: { firstname: 'Linus', email: 'linus@usthb.dz', status: 'pro', phone: '0666' },
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

let submissionRequests: URL[] = [];
function serve(
  opts: { webhook?: Record<string, unknown>; submissions?: unknown[]; total?: number } = {}
) {
  submissionRequests = [];
  server.use(
    http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () =>
      HttpResponse.json(webhook(opts.webhook))
    ),
    http.get(`${API_URL}/inbound-webhooks/${WEBHOOK_ID}/submissions`, ({ request }) => {
      submissionRequests.push(new URL(request.url));
      const submissions = opts.submissions ?? [ADA, LINUS];
      return HttpResponse.json({
        submissions,
        total: opts.total ?? submissions.length,
        limit: 50,
        offset: Number(new URL(request.url).searchParams.get('offset')),
      });
    }),
    http.get(`${API_URL}/inbound-webhooks/${WEBHOOK_ID}/submissions/s1`, () =>
      HttpResponse.json({ ...ADA, ipAddress: '10.0.0.7', userAgent: 'curl/8' })
    )
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => useToastStore.setState({ toasts: [] }));

describe('Inbound webhook page: submissions', () => {
  it('shows the webhook and, by default, the first three answers in schema order', async () => {
    serve();
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    expect(await screen.findByRole('heading', { name: 'Recruitment' })).toBeInTheDocument();
    expect(screen.getByText('recruitment')).toBeInTheDocument();
    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@usthb.dz')).toBeInTheDocument();
    expect(screen.getByText('student')).toBeInTheDocument();
    expect(screen.queryByText('0555')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'identity.status' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'identity.phone' })).toBeNull();
  });

  it('reads a flat schema by field name', async () => {
    serve({
      webhook: { schema: FLAT },
      submissions: [submission('f1', { title: 'Rust night', online: true })],
    });
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    expect(await screen.findByText('Rust night')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'title' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'online' })).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('lets the admin choose other columns and remembers them for this webhook', async () => {
    serve();
    const { unmount } = render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'identity.phone' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'identity.email' }));

    expect(screen.getByText('0555')).toBeInTheDocument();
    expect(screen.queryByText('ada@usthb.dz')).toBeNull();

    unmount();
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    expect(await screen.findByText('0555')).toBeInTheDocument();
    expect(screen.queryByText('ada@usthb.dz')).toBeNull();
  });

  it('goes back to the first three answers on request', async () => {
    serve();
    localStorage.setItem(
      `inbound-webhook-columns:${WEBHOOK_ID}`,
      JSON.stringify(['identity.phone'])
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('0555');

    await userEvent.click(screen.getByRole('button', { name: 'Columns' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Show the first three' }));

    expect(await screen.findByText('ada@usthb.dz')).toBeInTheDocument();
    expect(screen.queryByText('0555')).toBeNull();
  });

  it('filters by date, to the end of the chosen last day', async () => {
    serve();
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.type(screen.getByLabelText('From (UTC)'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('To (UTC)'), '2026-10-04');

    await waitFor(() => {
      const last = submissionRequests.at(-1);
      expect(last?.searchParams.get('dateFrom')).toBe('2026-10-01');
      expect(last?.searchParams.get('dateTo')).toBe('2026-10-04T23:59:59.999Z');
    });
  });

  it('pages through the results fifty at a time', async () => {
    serve({ total: 120 });
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));

    await waitFor(() => expect(submissionRequests.at(-1)?.searchParams.get('offset')).toBe('50'));
    expect(submissionRequests.at(-1)?.searchParams.get('limit')).toBe('50');
  });

  it('opens a submission in full', async () => {
    serve();
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(screen.getAllByRole('button', { name: /2026|Oct/ })[0]!);

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('10.0.0.7')).toBeInTheDocument();
    expect(within(dialog).getByText('curl/8')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Payload')).toHaveTextContent('"phone": "0555"');
  });

  it('says so when there is nothing yet', async () => {
    serve({ submissions: [] });
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    expect(await screen.findByText('No submissions yet')).toBeInTheDocument();
  });

  it('explains a 404 from the read API as a missing reader role', async () => {
    serve();
    server.use(
      http.get(`${API_URL}/inbound-webhooks/${WEBHOOK_ID}/submissions`, () =>
        HttpResponse.json({ message: 'Not Found', error: 'Not Found' }, { status: 404 })
      )
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    expect(
      await screen.findByText("You don't hold a role that can read this webhook's submissions")
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});

describe('Inbound webhook page: header and settings', () => {
  it('turns the webhook off and on from the header', async () => {
    serve();
    let sent: unknown = null;
    server.use(
      http.patch(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json(webhook({ isActive: false }));
      })
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    await userEvent.click(await screen.findByRole('switch', { name: 'Active' }));

    await waitFor(() => expect(sent).toEqual({ isActive: false }));
    expect(await screen.findByText(/refused with 410 Gone/)).toBeInTheDocument();
  });

  it('saves only after something changed, with the origins parsed', async () => {
    serve();
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          webhook({ name: 'Recruitment 2027', updatedAt: '2026-10-05T10:00:00.000Z' })
        );
      })
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    expect(screen.getByLabelText('Accepted origins')).toHaveValue('https://a.dz');

    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Recruitment 2027');
    await userEvent.type(screen.getByLabelText('Accepted origins'), '{enter}https://b.dz');
    await userEvent.click(screen.getByRole('switch', { name: /Reject unknown fields/ }));
    await userEvent.click(save);

    await waitFor(() =>
      expect(sent).toEqual({
        name: 'Recruitment 2027',
        acceptedOrigins: ['https://a.dz', 'https://b.dz'],
        requireSignature: true,
        rejectUnknownFields: false,
      })
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled());
    expect(screen.getByRole('heading', { name: 'Recruitment 2027' })).toBeInTheDocument();
  });

  it('will not save an empty name', async () => {
    serve();
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));

    await userEvent.clear(screen.getByLabelText('Name'));

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('reports a refused save and keeps the form', async () => {
    serve();
    server.use(
      http.patch(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () =>
        HttpResponse.json({ message: 'name too long', error: 'Bad Request' }, { status: 400 })
      )
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });
    await userEvent.click(await screen.findByRole('tab', { name: 'Settings' }));
    await userEvent.type(screen.getByLabelText('Name'), 'x');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((toast) => toast.message)).toContain(
        'name too long'
      )
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Recruitmentx');
  });
});

describe('Inbound webhook page: developer docs', () => {
  it('shows the generated Markdown and offers both downloads', async () => {
    serve();
    server.use(
      http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/docs`, () =>
        HttpResponse.text('# Recruitment\n\n| Field | Type |\n| --- | --- |\n| `a` | string |', {
          headers: { 'Content-Type': 'text/markdown' },
        })
      )
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    await userEvent.click(await screen.findByRole('tab', { name: 'Developer docs' }));

    const docs = within(await screen.findByRole('tabpanel', { name: 'Developer docs' }));
    expect(await docs.findByRole('heading', { name: 'Recruitment', level: 1 })).toBeInTheDocument();
    expect(docs.getByRole('columnheader', { name: 'Field' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download Markdown/ })).toHaveAttribute(
      'href',
      `${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/docs?format=markdown&download=true`
    );
    expect(screen.getByRole('link', { name: /Download OpenAPI/ })).toHaveAttribute(
      'href',
      `${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}/docs?format=openapi&download=true`
    );
  });
});

describe('Inbound webhook page: loading problems', () => {
  it('says when the webhook does not exist', async () => {
    server.use(
      http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () =>
        HttpResponse.json(
          { message: 'Inbound webhook not found', error: 'Not Found' },
          { status: 404 }
        )
      )
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    expect(await screen.findByText('Inbound webhook not found')).toBeInTheDocument();
  });

  it('can be retried after a server error', async () => {
    server.use(
      http.get(`${API_URL}/admin/inbound-webhooks/${WEBHOOK_ID}`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    render(<WebhookView webhookId={WEBHOOK_ID} />, { wrapper });

    expect(await screen.findByText('Couldn’t load this webhook')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
