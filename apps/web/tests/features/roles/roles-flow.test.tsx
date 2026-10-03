import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RolesView } from '@/app/dashboard/servers/[id]/roles/roles-view';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactNode) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockServers = [
  {
    id: 'srv_1',
    name: 'Main Server',
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

const roleStats = {
  serverId: 'srv_1',
  serverName: 'Main Server',
  totalMembers: 100,
  roles: [
    {
      roleId: 'role_dev',
      roleName: 'Developer',
      memberCount: 40,
      percentage: 40,
      hierarchyLevel: 5,
      color: null,
    },
  ],
};

describe('Roles page flow', () => {
  beforeEach(() => {
    push.mockClear();
    server.use(
      http.get('*/api/servers', () => HttpResponse.json(mockServers)),
      http.get('*/api/permissions/inheritance-rules', () => HttpResponse.json([])),
      http.get('*/api/admin/stats/roles', ({ request }) =>
        new URL(request.url).searchParams.get('serverId') === 'srv_1'
          ? HttpResponse.json(roleStats)
          : HttpResponse.json({ message: 'unexpected server' }, { status: 400 })
      )
    );
  });

  it('renders page heading and description', () => {
    renderWithProviders(<RolesView serverId="srv_1" />);

    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
    expect(
      screen.getByText("Manage this server's role-permission mappings and inheritance rules.")
    ).toBeInTheDocument();
  });

  it('takes the server from the URL instead of its own picker', async () => {
    renderWithProviders(<RolesView serverId="srv_1" />);

    expect(await screen.findByText('Developer')).toBeInTheDocument();
    expect(screen.queryByLabelText('Select server')).toBeNull();
  });

  it("opens a role under the same server's URL", async () => {
    renderWithProviders(<RolesView serverId="srv_1" />);

    await userEvent.click(await screen.findByText('Developer'));

    expect(push).toHaveBeenCalledWith('/dashboard/servers/srv_1/roles/role_dev');
  });
});
