import { describe, expect, it } from 'vitest';

import {
  mapGrowthResponse,
  mapMemberStatsResponse,
  mapRoleStatsResponse,
  mapServerStatsResponse,
} from '@/features/stats/api/mappers';
import type {
  GrowthResponseDto,
  MemberStatsDto,
  GlobalRoleStatsResponseDto,
  ServerRoleStatsResponseDto,
  ServerStatsDto,
} from '@/features/stats/types';

describe('stats mappers', () => {
  it('preserves cumulative growth and maps real member departures', () => {
    const response: GrowthResponseDto = {
      data: [
        {
          date: '2026-08-01T00:00:00.000Z',
          count: 120,
          newMembers: 8,
          leftMembers: 3,
        },
        {
          date: '2026-08-02T00:00:00.000Z',
          count: 124,
          newMembers: 6,
          leftMembers: 2,
        },
      ],
      period: '7d',
      totalGrowth: 9,
    };

    const mapped = mapGrowthResponse(response);

    expect(mapped.data).toEqual([
      expect.objectContaining({ count: 120, newMembers: 8, leftMembers: 3, netMembers: 5 }),
      expect.objectContaining({ count: 124, newMembers: 6, leftMembers: 2, netMembers: 4 }),
    ]);
    expect(mapped.totalGrowth).toBe(9);
  });

  it('maps the member summary without losing server or role data', () => {
    const response: MemberStatsDto = {
      totalMembers: 100,
      clubMembers: 70,
      nonClubMembers: 30,
      activeMembers: 95,
      inactiveMembers: 5,
      newMembersThisPeriod: 12,
      growthRate: 4.2,
      byRole: [
        { roleName: '  Executive  ', count: 12, percentage: 12 },
        { roleName: '   ', count: 2, percentage: 2 },
      ],
      byServer: [{ serverId: 'server-1', serverName: 'Main', memberCount: 100 }],
    };

    expect(mapMemberStatsResponse(response)).toEqual({
      ...response,
      byRole: [
        { roleName: 'Executive', count: 12, percentage: 12 },
        { roleName: 'Unnamed role', count: 2, percentage: 2 },
      ],
    });
  });

  it('maps dedicated server statistics for the grouped comparison chart', () => {
    const response: ServerStatsDto = {
      servers: [
        {
          serverId: 'server-1',
          serverName: 'Main',
          memberCount: 120,
          activeMembers: 110,
          roleCount: 15,
          lastSync: '2026-08-22T10:00:00.000Z',
          syncStatus: 'success',
        },
      ],
      totalServers: 1,
      totalMembers: 120,
    };

    expect(mapServerStatsResponse(response)).toEqual(response);
  });

  it('maps global role stats without assuming server-only role fields', () => {
    const response: GlobalRoleStatsResponseDto = {
      serverId: null,
      serverName: null,
      scope: 'global',
      roles: [
        { roleName: 'Member', memberCount: 250 },
        { roleName: 'Executive', memberCount: 75 },
      ],
      totalMembers: 500,
    };

    expect(mapRoleStatsResponse(response)).toEqual({
      serverId: null,
      serverName: null,
      scope: 'global',
      totalMembers: 500,
      roles: [
        expect.objectContaining({
          roleId: null,
          roleName: 'Member',
          memberCount: 250,
          percentage: 50,
          hierarchyLevel: null,
          color: null,
        }),
        expect.objectContaining({ roleName: 'Executive', percentage: 15 }),
      ],
    });
  });

  it('maps server role metadata and converts Discord integer colors to hex', () => {
    const response: ServerRoleStatsResponseDto = {
      serverId: 'server-1',
      serverName: 'Main',
      scope: 'server',
      roles: [
        {
          roleId: 'role-1',
          roleName: 'Member',
          memberCount: 80,
          hierarchyLevel: 3,
          color: 3447003,
        },
      ],
      totalMembers: 100,
    };

    expect(mapRoleStatsResponse(response).roles[0]).toEqual({
      roleId: 'role-1',
      roleName: 'Member',
      memberCount: 80,
      percentage: 80,
      hierarchyLevel: 3,
      color: '#3498db',
    });
  });
});
