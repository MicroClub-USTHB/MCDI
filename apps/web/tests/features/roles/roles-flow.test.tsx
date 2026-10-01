import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RolesPage from '@/app/dashboard/roles/page';
import { http, HttpResponse } from 'msw';
import { server } from '../../setup';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

describe('Roles page flow', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/servers', () => HttpResponse.json(mockServers)),
      http.get('*/api/permissions/inheritance-rules', () => HttpResponse.json([]))
    );
  });

  it('renders page heading and description', () => {
    renderWithProviders(<RolesPage />);

    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Manage role-permission mappings and configure inheritance rules across servers.'
      )
    ).toBeInTheDocument();
  });

  it('renders the server selector', () => {
    renderWithProviders(<RolesPage />);

    expect(screen.getByLabelText('Select server')).toBeInTheDocument();
  });

  it('does not render a role table before a server is selected', () => {
    renderWithProviders(<RolesPage />);

    expect(screen.queryByText('Role')).toBeNull();
  });
});
