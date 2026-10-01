import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useServersQueryMock = vi.hoisted(() => vi.fn());
const useMemberStatsQueryMock = vi.hoisted(() => vi.fn());
const useMemberGrowthQueryMock = vi.hoisted(() => vi.fn());
const useRoleStatsQueryMock = vi.hoisted(() => vi.fn());
const useServerStatsQueryMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/servers', () => ({ useServersQuery: useServersQueryMock }));
vi.mock('@/features/stats/api/queries', () => ({
  useMemberStatsQuery: useMemberStatsQueryMock,
  useMemberGrowthQuery: useMemberGrowthQueryMock,
  useRoleStatsQuery: useRoleStatsQueryMock,
  useServerStatsQuery: useServerStatsQueryMock,
}));

import StatsPage from '@/app/dashboard/stats/page';

const memberStats = {
  totalMembers: 100,
  clubMembers: 70,
  nonClubMembers: 30,
  activeMembers: 95,
  inactiveMembers: 5,
  newMembersThisPeriod: 8,
  growthRate: 4.2,
  byRole: [],
  byServer: [{ serverId: 'server-1', serverName: 'Main', memberCount: 100 }],
};

const growthStats = {
  period: '30d' as const,
  totalGrowth: 8,
  data: [
    {
      date: '2026-08-01T00:00:00.000Z',
      count: 100,
      newMembers: 8,
      leftMembers: 2,
      netMembers: 6,
    },
  ],
};

const roleStats = {
  serverId: null,
  serverName: null,
  scope: 'global' as const,
  totalMembers: 100,
  roles: [
    {
      roleId: null,
      roleName: 'Member',
      memberCount: 80,
      percentage: 80,
      hierarchyLevel: null,
      color: null,
    },
  ],
};

const serverStats = {
  servers: [
    {
      serverId: 'server-1',
      serverName: 'Main',
      memberCount: 100,
      activeMembers: 95,
      roleCount: 8,
      lastSync: null,
      syncStatus: 'success',
    },
  ],
  totalServers: 1,
  totalMembers: 100,
};

function successQuery<T>(data: T) {
  return { data, isPending: false, isError: false, refetch: vi.fn() };
}

describe('Member Statistics page', () => {
  it('changes the growth request inputs when the date range changes', () => {
    useServersQueryMock.mockReturnValue(successQuery([{ id: 'server-1', name: 'Main' }]));
    useMemberStatsQueryMock.mockReturnValue(successQuery(memberStats));
    useMemberGrowthQueryMock.mockReturnValue(successQuery(growthStats));
    useRoleStatsQueryMock.mockReturnValue(successQuery(roleStats));
    useServerStatsQueryMock.mockReturnValue(successQuery(serverStats));

    render(<StatsPage />);

    fireEvent.click(screen.getByRole('button', { name: '1 year' }));

    expect(useMemberGrowthQueryMock).toHaveBeenLastCalledWith('1y', 'monthly');
  });

  it('renders a compact loading state and a retryable error state', () => {
    useServersQueryMock.mockReturnValue(successQuery([]));
    useMemberStatsQueryMock.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    useMemberGrowthQueryMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    });
    useRoleStatsQueryMock.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    });
    useServerStatsQueryMock.mockReturnValue(successQuery(serverStats));

    render(<StatsPage />);

    expect(screen.getByLabelText('Loading member summary')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(2);
    expect(
      screen.queryByText(/coming soon|blocked|backend pending|unavailable/i)
    ).not.toBeInTheDocument();
  });
});
