import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../setup';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

import { ProjectRedirect, ServerRedirect } from '@/shared/components/layout/context-redirect';
import { rememberContextId } from '@/shared/lib/last-context';

const API_URL = 'http://localhost:3000/api';

function serverDto(id: string, name: string) {
  return {
    id,
    name,
    icon: null,
    type: 'main',
    isMain: false,
    isActive: true,
    syncFrequencyHours: 24,
    defaultPermissionPolicy: 'custom',
    disabledReason: null,
    syncedAt: null,
    lastSyncAt: null,
    botConnected: true,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

afterEach(() => replace.mockClear());

describe('ServerRedirect', () => {
  it('sends an old link to the same page of the last-used server', async () => {
    server.use(
      http.get(`${API_URL}/servers`, () =>
        HttpResponse.json([serverDto('srv_1', 'Main'), serverDto('srv_2', 'Events')])
      )
    );
    rememberContextId('server', 'srv_2');

    render(<ServerRedirect path="roles" />, { wrapper });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/servers/srv_2/roles'));
  });

  it('falls back to the first server when none was used yet', async () => {
    server.use(
      http.get(`${API_URL}/servers`, () =>
        HttpResponse.json([serverDto('srv_1', 'Main'), serverDto('srv_2', 'Events')])
      )
    );

    render(<ServerRedirect path="channels" />, { wrapper });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/servers/srv_1/channels'));
  });

  it('explains instead of redirecting when there are no servers', async () => {
    server.use(http.get(`${API_URL}/servers`, () => HttpResponse.json([])));

    render(<ServerRedirect path="sync" />, { wrapper });

    expect(await screen.findByText('No servers yet')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('ProjectRedirect', () => {
  it('sends an old link to the same page of the last-used project', async () => {
    server.use(
      http.get(`${API_URL}/admin/projects`, () =>
        HttpResponse.json([
          { id: 'proj_1', name: 'Website' },
          { id: 'proj_2', name: 'Bot' },
        ])
      )
    );
    rememberContextId('project', 'proj_2');

    render(<ProjectRedirect path="webhooks" />, { wrapper });

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/dashboard/projects/proj_2/webhooks')
    );
  });
});
