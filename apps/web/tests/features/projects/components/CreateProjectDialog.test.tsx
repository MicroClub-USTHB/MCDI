import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';

import { server } from '../../../setup';
import { CreateProjectDialog } from '@/features/projects/components';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const API_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const projectDto = {
  id: 'proj_1',
  name: 'Test Project',
  description: null,
  isInternal: false,
  webhookUrl: null,
  apiKeyPrefix: 'mcdi_live_abc123',
  apiKeyCreatedAt: '2026-08-19T10:00:00.000Z',
  apiKeyLastUsedAt: null,
  isActive: true,
  createdAt: '2026-08-19T10:00:00.000Z',
  updatedAt: '2026-08-19T10:00:00.000Z',
};

const servers = [
  {
    id: 'srv_1',
    name: 'Main',
    icon: null,
    type: 'main',
    isMain: true,
    isActive: true,
    syncFrequencyHours: 24,
    defaultPermissionPolicy: 'allow_all',
    disabledReason: null,
    syncedAt: null,
    lastSyncAt: null,
    botConnected: true,
  },
];

beforeEach(() => {
  push.mockClear();
});

describe('CreateProjectDialog', () => {
  it('walks the two-step wizard: project form → API-key reveal → redirect URI, then navigates to the detail page', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onOpenChange = vi.fn();

    const createBody: unknown[] = [];
    server.use(
      http.get(`${API_URL}/servers`, () => HttpResponse.json(servers)),
      http.post(`${API_URL}/admin/projects`, async ({ request }) => {
        createBody.push(await request.json());
        return HttpResponse.json({ apiKey: 'mcdi_live_secret_key_123', project: projectDto });
      }),
      http.patch(`${API_URL}/admin/projects/:id/redirect-uri`, async ({ request, params }) => {
        const body = await request.json();
        return HttpResponse.json({ projectId: params.id, redirectUri: body.redirectUri });
      })
    );

    render(<CreateProjectDialog open onOpenChange={onOpenChange} />, { wrapper });

    const nameInput = screen.getByLabelText('Project name');
    await userEvent.type(nameInput, 'Test Project');

    const mainServer = await waitFor(() =>
      screen.getByRole('checkbox', { name: 'Grant access to Main' })
    );
    await userEvent.click(mainServer);

    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText(/this is the only time/i)).toBeInTheDocument();
    await waitFor(() => expect(onOpenChange).not.toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: /reveal value/i }));
    expect(screen.getByDisplayValue('mcdi_live_secret_key_123')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /i've saved the key/i }));

    const redirectInput = screen.getByLabelText('Redirect URI(s)');
    await userEvent.type(redirectInput, 'https://app.example.com/auth/callback');
    await userEvent.click(screen.getByRole('button', { name: /finish/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard/projects/proj_1');
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('rejects an invalid redirect URI before hitting the backend', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onOpenChange = vi.fn();
    const patchSpy = vi.fn();
    server.use(
      http.get(`${API_URL}/servers`, () => HttpResponse.json(servers)),
      http.post(`${API_URL}/admin/projects`, () =>
        HttpResponse.json({ apiKey: 'mcdi_live_key', project: projectDto })
      ),
      http.patch(`${API_URL}/admin/projects/:id/redirect-uri`, async ({ request }) => {
        patchSpy(await request.json());
        return HttpResponse.json({ projectId: 'proj_1', redirectUri: '' });
      })
    );

    render(<CreateProjectDialog open onOpenChange={onOpenChange} />, { wrapper });

    const nameInput = screen.getByLabelText('Project name');
    await userEvent.type(nameInput, 'Bot One');

    await waitFor(() => screen.getByRole('checkbox', { name: 'Grant access to Main' }));
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    await screen.findByText(/this is the only time/i);
    await userEvent.click(screen.getByRole('button', { name: /i've saved the key/i }));

    const redirectInput = screen.getByLabelText('Redirect URI(s)');
    await userEvent.type(redirectInput, 'not-a-url');
    await userEvent.click(screen.getByRole('button', { name: /finish/i }));

    expect(await screen.findByText(/not a valid url/i)).toBeInTheDocument();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('supports provisioning an inbound webhook alongside the project and reveals both credentials', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onOpenChange = vi.fn();

    const createBody: Array<{
      name: string;
      inboundWebhook?: {
        name: string;
        slug?: string;
        schema: Record<string, unknown>;
      };
    }> = [];

    server.use(
      http.get(`${API_URL}/servers`, () => HttpResponse.json(servers)),
      http.post(`${API_URL}/admin/projects`, async ({ request }) => {
        const body = (await request.json()) as {
          name: string;
          inboundWebhook?: { name: string; slug?: string; schema: Record<string, unknown> };
        };
        createBody.push(body);
        return HttpResponse.json({
          apiKey: 'mcdi_live_secret_key_123',
          project: projectDto,
          inboundWebhook: {
            webhook: {
              id: 'wh_1',
              projectId: 'proj_1',
              name: 'Webhook Project Webhook',
              slug: 'webhook-project-webhook',
              schema: { version: 1, fields: [] },
              acceptedOrigins: [],
              requireSignature: true,
              rejectUnknownFields: true,
              allowRoleInheritance: true,
              isActive: true,
              submissionCount: 0,
              lastSubmissionAt: null,
              createdAt: '2026-08-19T10:00:00.000Z',
              updatedAt: '2026-08-19T10:00:00.000Z',
            },
            signingSecret: 'mcdi_whsec_live_9999',
            allowedRoleIds: [],
            submitUrl: 'https://api.microclub.dz/inbound-webhooks/wh_1/submit',
            docsUrl: 'https://api.microclub.dz/admin/inbound-webhooks/wh_1/docs',
          },
        });
      }),
      http.patch(`${API_URL}/admin/projects/:id/redirect-uri`, async ({ request, params }) => {
        const body = (await request.json()) as { redirectUri: string };
        return HttpResponse.json({ projectId: params.id, redirectUri: body.redirectUri });
      })
    );

    render(<CreateProjectDialog open onOpenChange={onOpenChange} />, { wrapper });

    const nameInput = screen.getByLabelText('Project name');
    await userEvent.type(nameInput, 'Webhook Project');

    // Toggle the inbound webhook switch
    const webhookSwitch = screen.getByRole('switch', { name: 'Inbound webhook' });
    await userEvent.click(webhookSwitch);

    // Verify webhook inputs appear
    const webhookNameInput = screen.getByLabelText('Webhook name');
    expect(webhookNameInput).toBeInTheDocument();
    expect(webhookNameInput).toHaveValue('Webhook Project Webhook');

    // Grant access to Main server
    const mainServer = await waitFor(() =>
      screen.getByRole('checkbox', { name: 'Grant access to Main' })
    );
    await userEvent.click(mainServer);

    // Submit form
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));

    // Verify payload sent
    await waitFor(() => {
      expect(createBody.length).toBe(1);
    });
    expect(createBody[0]?.inboundWebhook).toBeDefined();
    expect(createBody[0]?.inboundWebhook?.name).toBe('Webhook Project Webhook');

    // Verify both secrets revealed
    expect(await screen.findByText(/credentials generated/i)).toBeInTheDocument();
    expect(
      screen.getByText(/credentials \(api key and webhook signing secret\) will be shown/i)
    ).toBeInTheDocument();

    // Reveal inputs and verify values
    const revealButtons = screen.getAllByRole('button', { name: /reveal value/i });
    for (const btn of revealButtons) {
      await userEvent.click(btn);
    }
    expect(screen.getByDisplayValue('mcdi_live_secret_key_123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('mcdi_whsec_live_9999')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('https://api.microclub.dz/inbound-webhooks/wh_1/submit')
    ).toBeInTheDocument();

    // Confirm button for both secrets
    await userEvent.click(screen.getByRole('button', { name: /i've saved both secrets/i }));

    // Finish redirect URI step
    const redirectInput = screen.getByLabelText('Redirect URI(s)');
    await userEvent.type(redirectInput, 'https://app.example.com/auth/callback');
    await userEvent.click(screen.getByRole('button', { name: /finish/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard/projects/proj_1');
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
