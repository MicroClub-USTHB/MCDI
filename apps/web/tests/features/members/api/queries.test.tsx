import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { useAuthStore } from '@/features/auth/stores/auth';
import type { MemberFilters } from '@/features/members/types';

const BASE_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('members queries', () => {
  it('sends the list filters as query params and maps the response', async () => {
    let capturedUrl: URL | null = null;
    const filters: MemberFilters = {
      filter: 'club',
      serverIds: ['987654321', '111111111'],
      roleIds: ['123456789', '222222222'],
      search: 'clubber',
      page: 3,
      pageSize: 50,
    };

    server.use(
      http.get(`${BASE_URL}/admin/members`, ({ request }) => {
        capturedUrl = new URL(request.url);

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
                  serverId: '1',
                  serverName: 'Main',
                  isMainServer: true,
                  joinedAt: '2026-08-01T10:00:00.000Z',
                  roleNames: ['Admin'],
                },
              ],
            },
          ],
          total: 1,
          page: 3,
          limit: 50,
          totalPages: 1,
        });
      })
    );

    const { useMembersQuery } = await import('@/features/members/api/queries');
    const { result } = renderHook(() => useMembersQuery(filters), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl?.searchParams.get('filter')).toBe('club');
    expect(capturedUrl?.searchParams.get('serverId')).toBe('987654321');
    expect(capturedUrl?.searchParams.get('roleId')).toBe('123456789');
    expect(capturedUrl?.searchParams.get('search')).toBe('clubber');
    expect(capturedUrl?.searchParams.get('page')).toBe('3');
    expect(capturedUrl?.searchParams.get('limit')).toBe('50');
    expect(result.current.data?.data[0]?.avatarUrl).toBeNull();
  });

  it('fetches the member detail endpoint through the confirmed cross-server view', async () => {
    server.use(
      http.get(`${BASE_URL}/admin/members/:discordId/servers`, ({ params }) => {
        expect(params.discordId).toBe('123');

        return HttpResponse.json({
          memberId: '123',
          username: 'clubber',
          globalName: 'Clubber Lang',
          displayName: 'Clubber',
          avatar: 'https://cdn.discordapp.com/avatars/123/abc123.webp',
          isClubMember: true,
          servers: [
            {
              serverId: '1',
              serverName: 'Main',
              serverIcon: null,
              isMainServer: true,
              joinedAt: '2026-08-01T10:00:00.000Z',
              roles: [{ id: 'r1', name: 'Admin', color: 16711680, position: 10 }],
            },
          ],
        });
      })
    );

    const { useMemberQuery } = await import('@/features/members/api/queries');
    const { result } = renderHook(() => useMemberQuery('123'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      memberId: '123',
      username: 'clubber',
      displayName: 'Clubber',
      avatarUrl: 'https://cdn.discordapp.com/avatars/123/abc123.webp',
      servers: [
        {
          serverId: '1',
          serverName: 'Main',
          serverIcon: null,
          isMainServer: true,
          joinedAt: '2026-08-01T10:00:00.000Z',
          roles: [{ id: 'r1', name: 'Admin', color: '#ff0000', position: 10 }],
        },
      ],
    });
  });

  it('loads server roles for the selected server', async () => {
    server.use(
      http.get(`${BASE_URL}/admin/stats/roles`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('serverId')).toBe('987654321');

        return HttpResponse.json({
          serverId: '987654321',
          serverName: 'Main',
          scope: 'server',
          roles: [
            {
              roleId: '123456789',
              roleName: 'Admin',
              memberCount: 10,
              hierarchyLevel: 1,
              color: 16711680,
            },
          ],
          totalMembers: 10,
        });
      })
    );

    const { useServerRolesQuery } = await import('@/features/members/api/queries');
    const { result } = renderHook(() => useServerRolesQuery('987654321'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      serverId: '987654321',
      roles: [
        {
          roleId: '123456789',
          roleName: 'Admin',
        },
      ],
    });
  });

  it('does not clear the auth store when permissions fetch is unauthorized', async () => {
    useAuthStore.setState({
      user: {
        id: '1',
        username: 'admin',
        globalName: null,
        displayName: 'Admin',
        avatar: null,
        email: null,
        isSystemAdmin: true,
      },
      sessionExpiresAt: null,
      isAuthenticated: true,
      hasHydrated: true,
    });

    server.use(
      http.get(`${BASE_URL}/permissions/:serverId/:discordId`, () =>
        HttpResponse.json(
          {
            message: 'Unauthorized',
            error: 'Unauthorized',
            statusCode: 401,
          },
          { status: 401 }
        )
      )
    );

    const { fetchMemberPermissions } = await import('@/features/members/api/service');

    await expect(fetchMemberPermissions('server-1', '123')).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
