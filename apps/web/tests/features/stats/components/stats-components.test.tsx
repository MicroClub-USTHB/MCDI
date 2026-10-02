import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildStatsCsv,
  ChartEmpty,
  ChartError,
  ChartLoading,
  GrowthChart,
  MemberActivityChart,
  RoleDistributionChart,
  ServerComparisonChart,
} from '@/features/stats/components';
import type { GrowthStats, RoleStats, ServerStats } from '@/features/stats/types';
import type { MemberStats } from '@/features/stats/types';

const growthStats: GrowthStats = {
  period: '7d',
  totalGrowth: 4,
  data: [
    {
      date: '2026-08-01T00:00:00.000Z',
      count: 100,
      newMembers: 7,
      leftMembers: 3,
      netMembers: 4,
    },
  ],
};

const serverStats: ServerStats = {
  servers: [
    {
      serverId: 'server-1',
      serverName: 'Main',
      memberCount: 100,
      activeMembers: 90,
      roleCount: 12,
      lastSync: null,
      syncStatus: 'success',
    },
  ],
  totalServers: 1,
  totalMembers: 100,
};

const roleStats: RoleStats = {
  serverId: null,
  serverName: null,
  scope: 'global',
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

const memberStats: MemberStats = {
  totalMembers: 100,
  clubMembers: 80,
  nonClubMembers: 20,
  activeMembers: 75,
  inactiveMembers: 25,
  newMembersThisPeriod: 5,
  growthRate: 5,
  byRole: [],
  byServer: [],
};

describe('stats chart components', () => {
  it('shows departures as a distinct series and exposes exact bucket values', () => {
    render(<GrowthChart stats={growthStats} />);

    expect(screen.getByText('Members left')).toBeInTheDocument();
    const point = screen.getByRole('button', { name: /3 left/ });
    fireEvent.focus(point);

    expect(screen.getByText('-3')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /cumulative members, new members, and members who left/i })
    ).toHaveClass('h-56', 'w-full');
  });

  it('renders shared chart loading, empty, and retry states', () => {
    const retry = vi.fn();
    render(
      <>
        <ChartLoading label="member growth" />
        <ChartEmpty description="No data" />
        <ChartError onRetry={retry} />
      </>
    );

    expect(screen.getByRole('status', { name: 'Loading member growth' })).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders the server metrics as an accessible grouped bar chart', () => {
    render(<ServerComparisonChart stats={serverStats} />);

    expect(
      screen.getByRole('img', {
        name: /grouped bar chart showing members, active members, and roles/i,
      })
    ).toHaveClass('h-64', 'w-full');
    expect(screen.getByRole('button', { name: 'Main: Active members 90' })).toBeInTheDocument();
    expect(screen.getByText('Active members')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main: Members 100' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main: Roles 12' })).toBeInTheDocument();
  });

  it('renders role distribution as an accessible donut using the mapped role data', () => {
    render(<RoleDistributionChart stats={roleStats} />);

    const donut = screen.getByRole('img', { name: /global role distribution/i });
    expect(donut.getAttribute('style')).toContain('conic-gradient');
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('80 (80.0%)')).toBeInTheDocument();
  });

  it('shows exact role values when a donut segment is hovered or focused', () => {
    render(<RoleDistributionChart stats={roleStats} />);

    const segment = screen.getByRole('button', { name: /Member: 80 members \(80\.0%\)/ });
    fireEvent.mouseEnter(segment);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Member: 80 (80.0%)');

    fireEvent.focus(segment);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Member: 80 (80.0%)');
  });

  it('shows exact activity values when a donut segment is hovered or focused', () => {
    render(<MemberActivityChart stats={memberStats} />);

    const segment = screen.getByRole('button', { name: /Active: 75 members \(75\.0%\)/ });
    fireEvent.mouseEnter(segment);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Active: 75 (75.0%)');

    fireEvent.focus(segment);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Active: 75 (75.0%)');
  });

  it('exports the loaded statistics as escaped CSV rows', () => {
    const csv = buildStatsCsv({
      memberStats: {
        totalMembers: 1,
        clubMembers: 1,
        nonClubMembers: 0,
        activeMembers: 1,
        inactiveMembers: 0,
        newMembersThisPeriod: 1,
        growthRate: 100,
        byRole: [],
        byServer: [],
      },
      growthStats,
      roleStats: {
        serverId: null,
        serverName: null,
        scope: 'global',
        totalMembers: 1,
        roles: [],
      },
      serverStats,
    });

    expect(csv).toContain('"growth","bucket","","2026-08-01T00:00:00.000Z","100","7","3","4"');
    expect(csv).toContain('"section","metric","value"');
  });

  it('guards CSV cells against spreadsheet formula injection', () => {
    const csv = buildStatsCsv({
      memberStats: {
        totalMembers: 1,
        clubMembers: 1,
        nonClubMembers: 0,
        activeMembers: 1,
        inactiveMembers: 0,
        newMembersThisPeriod: 1,
        growthRate: 100,
        byRole: [],
        byServer: [],
      },
      growthStats,
      roleStats: {
        serverId: null,
        serverName: null,
        scope: 'global',
        totalMembers: 1,
        roles: [
          {
            roleId: 'role-1',
            roleName: '=1+1',
            memberCount: 1,
            percentage: 100,
            hierarchyLevel: null,
            color: null,
          },
        ],
      },
      serverStats: {
        ...serverStats,
        servers: [
          {
            ...serverStats.servers[0],
            serverName: '=cmd',
          },
        ],
      },
    });

    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"\'=cmd"');
  });
});
