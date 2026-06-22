import { StatsService } from './stats.service';

function makeRepo() {
  return {
    countMembers: jest.fn(),
    countClubMembers: jest.fn(),
    countActiveMembers: jest.fn(),
    countNewMembers: jest.fn(),
    countMembersBefore: jest.fn(),
    membersByServer: jest.fn().mockResolvedValue([]),
    membersByRole: jest.fn().mockResolvedValue([]),
    memberGrowthBuckets: jest.fn().mockResolvedValue([]),
    serverName: jest.fn(),
    roleDistribution: jest.fn().mockResolvedValue([]),
    listServers: jest.fn().mockResolvedValue([]),
    memberCountsByServer: jest.fn().mockResolvedValue([]),
    roleCountsByServer: jest.fn().mockResolvedValue([]),
    latestSyncByServer: jest.fn().mockResolvedValue([]),
    countServers: jest.fn(),
  };
}

describe('StatsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let redis: { getJson: jest.Mock; setJson: jest.Mock };
  let config: { get: jest.Mock };
  let service: StatsService;

  beforeEach(() => {
    repo = makeRepo();
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };
    service = new StatsService(repo as any, redis as any, config as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getMemberStats', () => {
    beforeEach(() => {
      repo.countMembers.mockResolvedValue(1200);
      repo.countClubMembers.mockResolvedValue(800);
      repo.countActiveMembers.mockResolvedValue(1100);
      repo.countNewMembers.mockResolvedValue(45);
      repo.membersByServer.mockResolvedValue([
        { serverId: 's1', serverName: 'Main', memberCount: 1200 },
      ]);
      repo.membersByRole.mockResolvedValue([
        { roleName: 'Member', count: 800 },
      ]);
    });

    it('assembles metrics with derived counts, growth rate and percentages', async () => {
      const result = await service.getMemberStats({ dateRange: '30d' } as any);

      expect(result).toMatchObject({
        totalMembers: 1200,
        clubMembers: 800,
        nonClubMembers: 400,
        activeMembers: 1100,
        inactiveMembers: 100,
        newMembersThisPeriod: 45,
        growthRate: 3.9, // 45 / (1200-45) * 100
      });
      expect(result.byRole[0]).toEqual({
        roleName: 'Member',
        count: 800,
        percentage: 66.67, // 800/1200*100
      });
      expect(result.byServer[0]).toEqual({
        serverId: 's1',
        serverName: 'Main',
        memberCount: 1200,
      });
    });

    it('caches the result on a miss (key includes scope + range, 5-min TTL)', async () => {
      await service.getMemberStats({ dateRange: '30d' } as any);
      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:members:all:30d');
      expect(redis.setJson).toHaveBeenCalledWith(
        'mcdi:stats:members:all:30d',
        expect.objectContaining({ totalMembers: 1200 }),
        300000,
      );
    });

    it('returns the cached value and skips computation on a hit', async () => {
      redis.getJson.mockResolvedValue({ totalMembers: 7 });
      const result = await service.getMemberStats({ dateRange: '30d' } as any);
      expect(result).toEqual({ totalMembers: 7 });
      expect(repo.countMembers).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();
    });

    it('scopes the cache key and repo calls to a serverId', async () => {
      await service.getMemberStats({ serverId: 's1', dateRange: '7d' } as any);
      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:members:s1:7d');
      expect(repo.countMembers).toHaveBeenCalledWith('s1');
      expect(repo.countNewMembers).toHaveBeenCalledWith(expect.any(Date), 's1');
    });
  });

  describe('getMemberGrowth', () => {
    it('builds a cumulative series, fixes leftMembers to 0, and sums growth', async () => {
      repo.countMembersBefore.mockResolvedValue(1000);
      repo.memberGrowthBuckets.mockResolvedValue([
        { bucket: '2026-06-01T00:00:00.000Z', newMembers: 12 },
        { bucket: '2026-06-02T00:00:00.000Z', newMembers: 8 },
      ]);

      const result = await service.getMemberGrowth({
        period: '30d',
        granularity: 'daily',
      } as any);

      expect(repo.memberGrowthBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'day',
      );
      expect(result.data).toEqual([
        {
          date: '2026-06-01T00:00:00.000Z',
          count: 1012,
          newMembers: 12,
          leftMembers: 0,
        },
        {
          date: '2026-06-02T00:00:00.000Z',
          count: 1020,
          newMembers: 8,
          leftMembers: 0,
        },
      ]);
      expect(result.totalGrowth).toBe(20);
      expect(result.period).toBe('30d');
    });

    it('maps granularity to the SQL date_trunc unit', async () => {
      repo.countMembersBefore.mockResolvedValue(0);
      await service.getMemberGrowth({
        period: '90d',
        granularity: 'monthly',
      } as any);
      expect(repo.memberGrowthBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'month',
      );
    });
  });

  describe('getRoleStats', () => {
    it('returns role distribution and total for the server', async () => {
      repo.serverName.mockResolvedValue('Main');
      repo.roleDistribution.mockResolvedValue([
        {
          roleId: 'r1',
          roleName: 'Member',
          hierarchyLevel: 1,
          color: 123,
          memberCount: 800,
        },
      ]);
      repo.countMembers.mockResolvedValue(1200);

      const result = await service.getRoleStats({ serverId: 's1' } as any);

      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:roles:s1');
      expect(result).toEqual({
        serverId: 's1',
        serverName: 'Main',
        roles: [
          {
            roleId: 'r1',
            roleName: 'Member',
            memberCount: 800,
            hierarchyLevel: 1,
            color: 123,
          },
        ],
        totalMembers: 1200,
      });
    });
  });

  describe('getServerStats', () => {
    it('joins per-server aggregates by id and defaults missing data', async () => {
      repo.listServers.mockResolvedValue([
        { serverId: 's1', serverName: 'Main' },
        { serverId: 's2', serverName: 'Side' },
      ]);
      repo.memberCountsByServer.mockResolvedValue([
        { serverId: 's1', memberCount: 1200, activeMembers: 1100 },
      ]);
      repo.roleCountsByServer.mockResolvedValue([
        { serverId: 's1', roleCount: 15 },
      ]);
      repo.latestSyncByServer.mockResolvedValue([
        {
          serverId: 's1',
          status: 'success',
          finishedAt: new Date('2026-06-22T10:00:00.000Z'),
        },
      ]);
      repo.countServers.mockResolvedValue(2);
      repo.countMembers.mockResolvedValue(1200);

      const result = await service.getServerStats();

      expect(result.totalServers).toBe(2);
      expect(result.totalMembers).toBe(1200);
      expect(result.servers[0]).toEqual({
        serverId: 's1',
        serverName: 'Main',
        memberCount: 1200,
        activeMembers: 1100,
        roleCount: 15,
        lastSync: '2026-06-22T10:00:00.000Z',
        syncStatus: 'success',
      });
      // s2 has no member/role/sync rows → safe defaults
      expect(result.servers[1]).toEqual({
        serverId: 's2',
        serverName: 'Side',
        memberCount: 0,
        activeMembers: 0,
        roleCount: 0,
        lastSync: null,
        syncStatus: 'never',
      });
    });
  });

  describe('cache TTL override', () => {
    it('honours app.statsCacheTtlMs from config', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'app.statsCacheTtlMs' ? 60000 : undefined,
      );
      service = new StatsService(repo as any, redis as any, config as any);
      repo.countMembers.mockResolvedValue(0);
      repo.countClubMembers.mockResolvedValue(0);
      repo.countActiveMembers.mockResolvedValue(0);
      repo.countNewMembers.mockResolvedValue(0);

      await service.getMemberStats({ dateRange: '30d' } as any);
      expect(redis.setJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        60000,
      );
    });
  });
});
