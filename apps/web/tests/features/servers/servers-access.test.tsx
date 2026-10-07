import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/servers',
}));

import { ServersView } from '@/app/dashboard/servers/servers-view';
import { ServerForm } from '@/features/servers';

const API = 'http://localhost:3000/api';

const serverDto = {
  id: 'srv_1',
  name: 'MicroClub',
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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function useServers() {
  server.use(
    http.get(`${API}/servers`, () => HttpResponse.json([serverDto])),
    http.get(`${API}/admin/sync/status/all`, () => HttpResponse.json([]))
  );
}

describe('Servers list actions', () => {
  it('shows no write or manage action to a read-only member', async () => {
    useServers();
    signInAs({ permissions: { servers: 'read' } });
    render(<ServersView />, { wrapper });

    await screen.findByText('MicroClub');
    expect(screen.queryByRole('button', { name: /add server/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync all servers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('lets a writer add, disable and sync but not delete', async () => {
    useServers();
    signInAs({ permissions: { servers: 'write', sync: 'write' } });
    render(<ServersView />, { wrapper });

    await screen.findByText('MicroClub');
    expect(screen.getAllByRole('button', { name: /add server/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /sync all servers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('lets a manager delete', async () => {
    useServers();
    signInAs({ permissions: { servers: 'manage' } });
    render(<ServersView />, { wrapper });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument());
  });
});

describe('Server edit form access', () => {
  const dto = {
    ...serverDto,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('is read-only for a member who can only read servers', () => {
    signInAs({ permissions: { servers: 'read' } });
    render(<ServerForm mode="edit" server={dto as never} onSubmit={vi.fn()} />);

    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/server name/i)).toBeDisabled();
  });

  it('can be saved by a member with servers:write', () => {
    signInAs({ permissions: { servers: 'write' } });
    render(<ServerForm mode="edit" server={dto as never} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/server name/i)).toBeEnabled();
  });
});
