import { useState, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { ExportButton, MemberFilters, MemberTable } from '@/features/members/components';
import { useMembersQuery } from '@/features/members/api/queries';
import type { MemberFilters as MemberFiltersState } from '@/features/members/types';
import type { DataTableColumn } from '@/features/members/components/data-table';
import type { MemberListItem } from '@/features/members/types';

const BASE_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function MembersFlowHarness() {
  const [filters, setFilters] = useState<MemberFiltersState>({
    filter: 'all',
    serverIds: [],
    roleIds: [],
    search: undefined,
    page: 1,
    pageSize: 50,
  });

  const query = useMembersQuery(filters);
  const columns: DataTableColumn<MemberListItem>[] = [
    {
      id: 'member',
      header: 'Member',
      cell: (member) => member.displayName,
    },
  ];

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
      <div className="flex gap-2">
        <ExportButton format="csv" filters={filters} />
        <ExportButton format="json" filters={filters} />
      </div>
      <MemberTable
        members={query.data?.data ?? []}
        columns={columns}
        pagination={{
          data: query.data?.data ?? [],
          total: query.data?.total ?? 0,
          page: query.data?.page ?? filters.page,
          pageSize: query.data?.pageSize ?? filters.pageSize,
          totalPages: query.data?.totalPages ?? 1,
        }}
        onRowClick={vi.fn()}
        onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
        onPageSizeChange={(pageSize) =>
          setFilters((current) => ({ ...current, pageSize, page: 1 }))
        }
        isLoading={query.isPending}
      />
    </div>
  );
}

describe('members flow', () => {
  it('searches, filters, and exports with the active filters applied', async () => {
    let listRequestUrl: URL | null = null;
    let exportRequestUrl: URL | null = null;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:members');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

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
        ])
      ),
      http.get(`${BASE_URL}/admin/stats/roles`, () =>
        HttpResponse.json({
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
          ],
          totalMembers: 5,
        })
      ),
      http.get(`${BASE_URL}/admin/members`, ({ request }) => {
        listRequestUrl = new URL(request.url);

        return HttpResponse.json({
          data: [
            {
              memberId: '123',
              username: 'clubber',
              globalName: 'Clubber Lang',
              avatar: null,
              isClubMember: true,
              serverCount: 1,
              servers: [
                {
                  serverId: 'server-main',
                  serverName: 'Main Server',
                  isMainServer: true,
                  joinedAt: '2026-08-01T10:00:00.000Z',
                  roleNames: ['Admin'],
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
        });
      }),
      http.get(`${BASE_URL}/admin/members/export`, ({ request }) => {
        exportRequestUrl = new URL(request.url);
        return new HttpResponse('id,username\n123,clubber\n', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="members.csv"',
          },
        });
      })
    );

    const user = userEvent.setup();

    render(<MembersFlowHarness />, { wrapper });

    await screen.findByText('Clubber Lang');
    await screen.findByRole('button', { name: 'Servers' });

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'club');
    await waitFor(() => expect(listRequestUrl?.searchParams.get('search')).toBe('club'));

    await user.click(screen.getByRole('button', { name: 'Servers' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Main Server' }));
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Roles' }));
    await waitFor(() =>
      expect(screen.getByRole('menuitemcheckbox', { name: 'Admin' })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Admin' }));
    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(listRequestUrl?.searchParams.getAll('serverId')).toEqual(['server-main'])
    );
    expect(listRequestUrl?.searchParams.getAll('roleId')).toEqual(['role-admin']);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledOnce());
    expect(exportRequestUrl?.searchParams.get('search')).toBe('club');
    expect(exportRequestUrl?.searchParams.getAll('serverId')).toEqual(['server-main']);
    expect(exportRequestUrl?.searchParams.getAll('roleId')).toEqual(['role-admin']);
    expect(exportRequestUrl?.searchParams.get('format')).toBe('csv');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:members');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  }, 10000);
});
