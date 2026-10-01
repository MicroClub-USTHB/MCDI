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
});
