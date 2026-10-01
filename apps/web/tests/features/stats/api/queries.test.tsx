import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  useMemberGrowthQuery,
  useMemberStatsQuery,
  useRoleStatsQuery,
  useServerStatsQuery,
} from '@/features/stats/api/queries';
import { server } from '../../../setup';

const BASE_URL = 'http://localhost:3000/api';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('stats queries', () => {
  it('sends the documented member summary filters', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${BASE_URL}/admin/stats/members`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({
          totalMembers: 1,
          clubMembers: 1,
          nonClubMembers: 0,
          activeMembers: 1,
          inactiveMembers: 0,
          newMembersThisPeriod: 0,
          growthRate: 0,
          byRole: [],
          byServer: [],
        });
      })
    );

    const { result } = renderHook(
      () => useMemberStatsQuery({ serverId: 'server-1', dateRange: '90d' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe('/api/admin/stats/members');
    expect(url.searchParams.get('serverId')).toBe('server-1');
    expect(url.searchParams.get('dateRange')).toBe('90d');
  });

  it('sends the period and compact granularity to the growth endpoint', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${BASE_URL}/admin/stats/members/growth`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ data: [], period: '90d', totalGrowth: 0 });
      })
    );

    const { result } = renderHook(() => useMemberGrowthQuery('90d', 'weekly'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe('/api/admin/stats/members/growth');
    expect(url.searchParams.get('period')).toBe('90d');
    expect(url.searchParams.get('granularity')).toBe('weekly');
  });

  it('omits serverId for global roles and includes it for server-scoped roles', async () => {
    const requestedUrls: string[] = [];
    server.use(
      http.get(`${BASE_URL}/admin/stats/roles`, ({ request }) => {
        requestedUrls.push(request.url);
        const serverId = new URL(request.url).searchParams.get('serverId');
        return HttpResponse.json(
          serverId
            ? {
                serverId,
                serverName: 'Main',
                scope: 'server',
                roles: [],
                totalMembers: 0,
              }
            : {
                serverId: null,
                serverName: null,
                scope: 'global',
                roles: [],
                totalMembers: 0,
              }
        );
      })
    );

    const globalQuery = renderHook(() => useRoleStatsQuery(), { wrapper: createWrapper() });
    const serverQuery = renderHook(() => useRoleStatsQuery('server-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(globalQuery.result.current.isSuccess).toBe(true);
      expect(serverQuery.result.current.isSuccess).toBe(true);
    });

    expect(new URL(requestedUrls[0] ?? '').searchParams.has('serverId')).toBe(false);
    expect(new URL(requestedUrls[1] ?? '').searchParams.get('serverId')).toBe('server-1');
  });

  it('fetches dedicated server statistics without adding undocumented query parameters', async () => {
    let requestedUrl = '';
    server.use(
      http.get(`${BASE_URL}/admin/stats/servers`, ({ request }) => {
        requestedUrl = request.url;
        return HttpResponse.json({ servers: [], totalServers: 0, totalMembers: 0 });
      })
    );

    const { result } = renderHook(() => useServerStatsQuery(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe('/api/admin/stats/servers');
    expect(url.search).toBe('');
  });
});
