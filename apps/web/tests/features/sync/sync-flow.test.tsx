import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

import { SyncView } from '@/app/dashboard/servers/[id]/sync/sync-view';
import { ServersView } from '@/app/dashboard/servers/servers-view';
import { ToastContainer } from '@/shared/components/common';
import { useToastStore } from '@/shared/stores/toast';

const BASE_URL = 'http://localhost:3000/api';

function serverDto(id: string, name: string) {
  return {
    id,
    name,
    icon: null,
    type: 'main',
    isMain: id === 's-main',
    isActive: true,
    syncFrequencyHours: 24,
    defaultPermissionPolicy: 'custom',
    disabledReason: null,
    syncedAt: null,
    lastSyncAt: '2026-08-28T10:00:00.000Z',
    botConnected: true,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

afterEach(() => {
  useToastStore.setState({ toasts: [] });
  pushMock.mockClear();
});

describe('sync flow', () => {
  it("shows this server's status, syncs it, and opens a run under the server", async () => {
    let syncBody: unknown = null;
    let logsQuery: URLSearchParams | null = null;

    server.use(
      http.get(`${BASE_URL}/servers`, () =>
        HttpResponse.json([
          serverDto('s-main', 'Main Server'),
          serverDto('s-events', 'Events Server'),
        ])
      ),
      http.get(`${BASE_URL}/admin/sync/status/all`, () =>
        HttpResponse.json([
          {
            serverId: 's-main',
            lastSyncAt: '2026-08-28T10:00:00.000Z',
            status: 'success',
            membersSynced: 40,
            rolesSynced: 6,
            startedAt: '2026-08-28T09:59:00.000Z',
            finishedAt: '2026-08-28T10:00:00.000Z',
          },
          {
            serverId: 's-events',
            lastSyncAt: '2026-08-27T10:00:00.000Z',
            status: 'failed',
            membersSynced: 0,
            rolesSynced: 0,
            message: 'Bot token rejected',
            startedAt: '2026-08-27T09:59:00.000Z',
          },
        ])
      ),
      http.get(`${BASE_URL}/admin/sync/logs`, ({ request }) => {
        logsQuery = new URL(request.url).searchParams;
        return HttpResponse.json({
          total: 2,
          logs: [
            {
              id: 7,
              serverId: 's-main',
              syncType: 'full',
              status: 'success',
              startedAt: '2026-08-28T09:59:00.000Z',
              finishedAt: '2026-08-28T09:59:12.000Z',
              membersSynced: 40,
              rolesSynced: 6,
            },
            {
              id: 8,
              serverId: 's-main',
              syncType: 'manual',
              status: 'failed',
              startedAt: '2026-08-27T09:59:00.000Z',
              finishedAt: '2026-08-27T09:59:03.000Z',
              membersSynced: 0,
              rolesSynced: 0,
              message: 'Rate limited by Discord',
            },
          ],
        });
      }),
      http.post(`${BASE_URL}/admin/sync/full`, async ({ request }) => {
        syncBody = await request.json();
        return HttpResponse.json(
          {
            results: [
              { serverId: 's-main', syncId: 101 },
              { serverId: 's-events', syncId: 102 },
            ],
          },
          { status: 202 }
        );
      })
    );

    const user = userEvent.setup();
    render(
      <>
        <SyncView serverId="s-main" />
        <ToastContainer />
      </>,
      { wrapper }
    );

    await screen.findByRole('heading', { name: 'Main Server' });
    expect(screen.queryByRole('heading', { name: 'Events Server' })).toBeNull();
    expect(screen.getByText('40 members · 6 roles synced')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sync all servers' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Sync now' }));
    await waitFor(() => expect(syncBody).toEqual({ serverIds: ['s-main'] }));
    expect(await screen.findByText('Sync started')).toBeInTheDocument();

    await waitFor(() => expect(logsQuery?.get('serverId')).toBe('s-main'));
    expect(logsQuery?.get('limit')).toBe('20');
    expect(logsQuery?.get('offset')).toBe('0');

    const rows = await screen.findAllByRole('row');
    await user.click(rows[1]!);
    expect(pushMock).toHaveBeenCalledWith('/dashboard/servers/s-main/sync/logs/7');

    // A failed run shows its error inline in the table and carries it to the detail page.
    expect(screen.getByText('Rate limited by Discord')).toBeInTheDocument();
    await user.click(rows[2]!);
    expect(pushMock).toHaveBeenCalledWith(
      '/dashboard/servers/s-main/sync/logs/8?error=Rate%20limited%20by%20Discord'
    );
  }, 15000);

  it('syncs every server from the Servers page', async () => {
    let syncBody: unknown = null;
    server.use(
      http.get(`${BASE_URL}/servers`, () =>
        HttpResponse.json([
          serverDto('s-main', 'Main Server'),
          serverDto('s-events', 'Events Server'),
        ])
      ),
      http.get(`${BASE_URL}/admin/sync/status/all`, () => HttpResponse.json([])),
      http.post(`${BASE_URL}/admin/sync/full`, async ({ request }) => {
        syncBody = await request.json();
        return HttpResponse.json({ results: [] }, { status: 202 });
      })
    );
    const user = userEvent.setup();

    render(
      <>
        <ServersView />
        <ToastContainer />
      </>,
      { wrapper }
    );

    await user.click(await screen.findByRole('button', { name: 'Sync all servers' }));
    await waitFor(() => expect(syncBody).toEqual({ target: 'all' }));
    expect(await screen.findByText('Sync started')).toBeInTheDocument();
  });
});
