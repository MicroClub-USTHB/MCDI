import { useState, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { MemberFilters } from '@/features/members/components/MemberFilters';
import type { MemberFilters as MemberFiltersState } from '@/features/members/types';

const BASE_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function FiltersHarness() {
  const [filters, setFilters] = useState<MemberFiltersState>({
    filter: 'all',
    serverIds: [],
    roleIds: [],
    search: undefined,
    page: 1,
    pageSize: 50,
  });

  return (
    <div className="space-y-4">
      <MemberFilters
        filters={filters}
        onFilterChange={(next) => setFilters((current) => ({ ...current, ...next }))}
        onClearFilters={() =>
          setFilters({
            filter: 'all',
            serverIds: [],
            roleIds: [],
            search: undefined,
            page: 1,
            pageSize: 50,
          })
        }
      />
      <output data-testid="filters-state">{JSON.stringify(filters)}</output>
    </div>
  );
}

describe('MemberFilters', () => {
  it('debounces search and supports multi-select server and role filters', async () => {
    server.use(
      http.get(`${BASE_URL}/servers`, () =>
        HttpResponse.json([
          {
            id: 'server-main',
            name: 'Main Server',
            icon: null,
            type: 'main',
            isMain: true,
            isActive: true,
            syncFrequencyHours: 24,
            defaultPermissionPolicy: 'custom',
            disabledReason: null,
            syncedAt: null,
            lastSyncAt: null,
            botConnected: true,
          },
          {
            id: 'server-event',
            name: 'Event Server',
            icon: null,
            type: 'event',
            isMain: false,
            isActive: true,
            syncFrequencyHours: 24,
            defaultPermissionPolicy: 'custom',
            disabledReason: null,
            syncedAt: null,
            lastSyncAt: null,
            botConnected: true,
          },
        ])
      ),
      http.get(`${BASE_URL}/admin/stats/roles`, ({ request }) => {
        const url = new URL(request.url);
        const serverId = url.searchParams.get('serverId');

        if (serverId === 'server-main') {
          return HttpResponse.json({
            serverId: 'server-main',
            serverName: 'Main Server',
            scope: 'server',
            roles: [
              {
                roleId: 'role-admin',
                roleName: 'Admin',
                memberCount: 5,
                hierarchyLevel: 2,
                color: 16711680,
              },
              {
                roleId: 'role-managed',
                roleName: '   ',
                memberCount: 1,
                hierarchyLevel: 0,
                color: null,
              },
            ],
            totalMembers: 5,
          });
        }

        return HttpResponse.json({
          serverId: 'server-event',
          serverName: 'Event Server',
          scope: 'server',
          roles: [
            {
              roleId: 'role-event',
              roleName: 'Event Lead',
              memberCount: 3,
              hierarchyLevel: 1,
              color: 3447003,
            },
          ],
          totalMembers: 3,
        });
      })
    );

    const user = userEvent.setup();

    render(<FiltersHarness />, { wrapper });

    await screen.findByRole('button', { name: 'Servers' });

    const searchInput = screen.getByRole('searchbox', { name: 'Search' });
    await user.type(searchInput, 'clubber');

    expect(screen.getByTestId('filters-state')).not.toHaveTextContent('clubber');

    await waitFor(() =>
      expect(screen.getByTestId('filters-state')).toHaveTextContent('"search":"clubber"')
    );

    await user.click(screen.getByRole('button', { name: 'Servers' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Main Server' }));

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Event Server' }));
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Roles' }));
    await waitFor(() =>
      expect(screen.getByRole('menuitemcheckbox', { name: 'Admin' })).toBeInTheDocument()
    );
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Unnamed role (role-managed)' })
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Event Lead' })).toBeInTheDocument();

    const roleSearch = screen.getByRole('searchbox', { name: 'Filter roles' });
    await user.type(roleSearch, 'event');
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Admin' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Event Lead' })).toBeInTheDocument();
    await user.clear(roleSearch);

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Admin' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Event Lead' }));

    await waitFor(() =>
      expect(screen.getByTestId('filters-state')).toHaveTextContent(
        '"roleIds":["role-admin","role-event"]'
      )
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Remove role Admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove role Event Lead' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Club members' }));
    expect(screen.getByTestId('filters-state')).toHaveTextContent('"filter":"club"');

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByTestId('filters-state')).toHaveTextContent('"filter":"all"');
  }, 10000);
});
