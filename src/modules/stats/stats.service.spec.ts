import { StatsService } from './stats.service';

function makeRepo() {
  return {
    countMembers: jest.fn(),
    countClubMembers: jest.fn(),
    countActiveMembers: jest.fn(),
    countNewMembers: jest.fn(),
    countMembersBefore: jest.fn(),
    countDeparturesBefore: jest.fn().mockResolvedValue(0),
    membersByServer: jest.fn().mockResolvedValue([]),
    membersByRole: jest.fn().mockResolvedValue([]),
    memberGrowthBuckets: jest.fn().mockResolvedValue([]),
    memberDepartureBuckets: jest.fn().mockResolvedValue([]),
    serverName: jest.fn(),
    roleDistribution: jest.fn().mockResolvedValue([]),
    globalRoleDistribution: jest.fn().mockResolvedValue([]),
    listServers: jest.fn().mockResolvedValue([]),
    memberCountsByServer: jest.fn().mockResolvedValue([]),
    roleCountsByServer: jest.fn().mockResolvedValue([]),
    latestSyncByServer: jest.fn().mockResolvedValue([]),
    latestSuccessfulSyncByServer: jest.fn().mockResolvedValue([]),
    countServers: jest.fn(),
    countMembersInMultipleServers: jest.fn(),
    serverOverlapPairs: jest.fn().mockResolvedValue([]),
  };
}

function makeDiscord() {
  return { hasGuildConnection: jest.fn().mockReturnValue(true) };
}

describe('StatsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let redis: { getJson: jest.Mock; setJson: jest.Mock };
  let config: { get: jest.Mock };
  let discord: ReturnType<typeof makeDiscord>;
  let service: StatsService;

  beforeEach(() => {
    repo = makeRepo();
    redis = {
      getJson: jest.fn().mockResolvedValue(null),
      setJson: jest.fn().mockResolvedValue(undefined),
    };
    config = { get: jest.fn().mockReturnValue(undefined) };
    discord = makeDiscord();
    service = new StatsService(
      repo as any,
      redis as any,
      config as any,
      discord as any,
    );
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
      const result = await service.getMemberStats({ dateRange: '30d' });

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
      await service.getMemberStats({ dateRange: '30d' });
      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:members:all:30d');
      expect(redis.setJson).toHaveBeenCalledWith(
        'mcdi:stats:members:all:30d',
        expect.objectContaining({ totalMembers: 1200 }),
        300000,
      );
    });

    it('returns the cached value and skips computation on a hit', async () => {
      redis.getJson.mockResolvedValue({ totalMembers: 7 });
      const result = await service.getMemberStats({ dateRange: '30d' });
      expect(result).toEqual({ totalMembers: 7 });
      expect(repo.countMembers).not.toHaveBeenCalled();
      expect(redis.setJson).not.toHaveBeenCalled();
    });

    it('scopes the cache key and repo calls to a serverId', async () => {
      await service.getMemberStats({ serverId: 's1', dateRange: '7d' });
      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:members:s1:7d');
      expect(repo.countMembers).toHaveBeenCalledWith('s1');
      expect(repo.countNewMembers).toHaveBeenCalledWith(expect.any(Date), 's1');
    });

    it('derives activeMembers from a recent-presence cutoff, not a raw flag', async () => {
      const result = await service.getMemberStats({
        serverId: 's1',
        dateRange: '30d',
      } as any);
      expect(repo.countActiveMembers).toHaveBeenCalledWith(
        expect.any(Date),
        's1',
      );
      expect(result.activityThresholdDays).toBe(30);
    });

    it('honours app.memberActivityThresholdDays from config', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'app.memberActivityThresholdDays' ? 7 : undefined,
      );
      service = new StatsService(
        repo as any,
        redis as any,
        config as any,
        discord as any,
      );
      const result = await service.getMemberStats({
        dateRange: '30d',
      } as any);

      expect(result.activityThresholdDays).toBe(7);
      const cutoffArg = repo.countActiveMembers.mock.calls.at(-1)?.[0] as Date;
      const expectedCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      // Allow a small margin for test execution time.
      expect(Math.abs(cutoffArg.getTime() - expectedCutoff)).toBeLessThan(5000);
    });
  });

  describe('getMemberGrowth', () => {
    it('builds a cumulative series with real leftMembers and net growth', async () => {
      repo.countMembersBefore.mockResolvedValue(1000);
      repo.countDeparturesBefore.mockResolvedValue(10);
      repo.memberGrowthBuckets.mockResolvedValue([
        { bucket: '2026-06-01T00:00:00.000Z', newMembers: 12 },
        { bucket: '2026-06-02T00:00:00.000Z', newMembers: 8 },
      ]);
      repo.memberDepartureBuckets.mockResolvedValue([
        { bucket: '2026-06-01T00:00:00.000Z', leftMembers: 2 },
        { bucket: '2026-06-03T00:00:00.000Z', leftMembers: 3 },
      ]);

      const result = await service.getMemberGrowth({
        period: '30d',
        granularity: 'daily',
      });

      expect(repo.memberGrowthBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'day',
        undefined,
      );
      expect(repo.memberDepartureBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'day',
        undefined,
      );
      // baseline = 1000 - 10 = 990
      // 2026-06-01: +12 - 2 -> running 1000 (net +10)
      // 2026-06-02: +8 - 0  -> running 1008 (net +8)
      // 2026-06-03: +0 - 3  -> running 1005 (net -3)
      expect(result.data).toEqual([
        {
          date: '2026-06-01T00:00:00.000Z',
          count: 1000,
          newMembers: 12,
          leftMembers: 2,
        },
        {
          date: '2026-06-02T00:00:00.000Z',
          count: 1008,
          newMembers: 8,
          leftMembers: 0,
        },
        {
          date: '2026-06-03T00:00:00.000Z',
          count: 1005,
          newMembers: 0,
          leftMembers: 3,
        },
      ]);
      expect(result.totalGrowth).toBe(15);
      expect(result.period).toBe('30d');
    });

    it('maps granularity to the SQL date_trunc unit', async () => {
      repo.countMembersBefore.mockResolvedValue(0);
      await service.getMemberGrowth({
        period: '90d',
        granularity: 'monthly',
      });
      expect(repo.memberGrowthBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'month',
        undefined,
      );
      expect(repo.memberDepartureBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'month',
        undefined,
      );
    });

    it('scopes the cache key and repo calls to a serverId', async () => {
      repo.countMembersBefore.mockResolvedValue(0);
      await service.getMemberGrowth({
        serverId: 's1',
        period: '30d',
        granularity: 'daily',
      } as any);
      expect(redis.getJson).toHaveBeenCalledWith(
        'mcdi:stats:growth:s1:30d:daily',
      );
      expect(repo.countMembersBefore).toHaveBeenCalledWith(
        expect.any(Date),
        's1',
      );
      expect(repo.countDeparturesBefore).toHaveBeenCalledWith(
        expect.any(Date),
        's1',
      );
      expect(repo.memberGrowthBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'day',
        's1',
      );
      expect(repo.memberDepartureBuckets).toHaveBeenCalledWith(
        expect.any(Date),
        'day',
        's1',
      );
    });

    it('reports trend=increase when the second half outweighs the first', async () => {
      repo.countMembersBefore.mockResolvedValue(0);
      repo.memberGrowthBuckets.mockResolvedValue([
        { bucket: '2026-06-01', newMembers: 1 },
        { bucket: '2026-06-02', newMembers: 1 },
        { bucket: '2026-06-03', newMembers: 5 },
        { bucket: '2026-06-04', newMembers: 5 },
      ]);
      const result = await service.getMemberGrowth({
        period: '30d',
        granularity: 'daily',
      } as any);
      expect(result.trend).toBe('increase');
    });

    it('reports trend=decrease when the second half trails the first', async () => {
      repo.countMembersBefore.mockResolvedValue(0);
      repo.memberGrowthBuckets.mockResolvedValue([
        { bucket: '2026-06-01', newMembers: 5 },
        { bucket: '2026-06-02', newMembers: 5 },
        { bucket: '2026-06-03', newMembers: 1 },
        { bucket: '2026-06-04', newMembers: 1 },
      ]);
      const result = await service.getMemberGrowth({
        period: '30d',
        granularity: 'daily',
      } as any);
      expect(result.trend).toBe('decrease');
    });

    it('reports trend=stable for a flat or too-short series', async () => {
      repo.countMembersBefore.mockResolvedValue(0);
      repo.memberGrowthBuckets.mockResolvedValue([
        { bucket: '2026-06-01', newMembers: 3 },
      ]);
      const result = await service.getMemberGrowth({
        period: '30d',
        granularity: 'daily',
      } as any);
      expect(result.trend).toBe('stable');
    });
  });

  describe('getRoleStats', () => {
    it('returns role distribution and total for the server (scoped)', async () => {
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

      const result = await service.getRoleStats({ serverId: 's1' });

      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:roles:s1');
      expect(result).toEqual({
        serverId: 's1',
        serverName: 'Main',
        scope: 'server',
        roles: [
          {
            roleId: 'r1',
            roleName: 'Member',
            memberCount: 800,
            percentage: 66.67, // 800/1200*100
            hierarchyLevel: 1,
            color: 123,
          },
        ],
        totalMembers: 1200,
      });
    });

    it('returns cross-server role distribution merged by name when serverId is omitted', async () => {
      repo.globalRoleDistribution.mockResolvedValue([
        {
          roleName: 'Member',
          memberCount: 1500,
        },
        {
          roleName: 'Admin',
          memberCount: 50,
        },
      ]);
      repo.countMembers.mockResolvedValue(2000);

      const result = await service.getRoleStats({});

      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:roles:all');
      expect(result).toEqual({
        serverId: null,
        serverName: null,
        scope: 'global',
        roles: [
          {
            roleName: 'Member',
            memberCount: 1500,
          },
          {
            roleName: 'Admin',
            memberCount: 50,
          },
        ],
        totalMembers: 2000,
      });
    });
  });

  describe('getServerStats', () => {
    it('passes an activity cutoff through to memberCountsByServer', async () => {
      await service.getServerStats();
      expect(repo.memberCountsByServer).toHaveBeenCalledWith(expect.any(Date));
    });

    it('joins per-server aggregates by id, including health fields', async () => {
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
          message: null,
        },
      ]);
      repo.latestSuccessfulSyncByServer.mockResolvedValue([
        { serverId: 's1', finishedAt: new Date('2026-06-22T10:00:00.000Z') },
      ]);
      repo.countServers.mockResolvedValue(2);
      repo.countMembers.mockResolvedValue(1200);
      discord.hasGuildConnection.mockImplementation(
        (id: string) => id === 's1',
      );

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
        lastSyncError: null,
        botStatus: 'online',
      });
      // s2 has no member/role/sync rows, and the bot isn't connected → safe defaults
      expect(result.servers[1]).toEqual({
        serverId: 's2',
        serverName: 'Side',
        memberCount: 0,
        activeMembers: 0,
        roleCount: 0,
        lastSync: null,
        syncStatus: 'never',
        lastSyncError: null,
        botStatus: 'offline',
      });
    });

    it('surfaces the error message only when the latest attempt failed', async () => {
      repo.listServers.mockResolvedValue([
        { serverId: 's1', serverName: 'Main' },
      ]);
      repo.latestSyncByServer.mockResolvedValue([
        {
          serverId: 's1',
          status: 'failure',
          finishedAt: new Date('2026-06-22T10:00:00.000Z'),
          message: 'guild unreachable',
        },
      ]);
      // No successful sync yet — lastSync stays null even though an attempt exists.
      repo.latestSuccessfulSyncByServer.mockResolvedValue([]);

      const result = await service.getServerStats();

      expect(result.servers[0].lastSync).toBeNull();
      expect(result.servers[0].syncStatus).toBe('failure');
      expect(result.servers[0].lastSyncError).toBe('guild unreachable');
    });
  });

  describe('getCrossServerStats', () => {
    it('returns the overlap member count and pairwise breakdown', async () => {
      repo.countMembersInMultipleServers.mockResolvedValue(42);
      repo.serverOverlapPairs.mockResolvedValue([
        {
          serverAId: 's1',
          serverAName: 'Main',
          serverBId: 's2',
          serverBName: 'Side',
          overlapCount: 18,
        },
      ]);

      const result = await service.getCrossServerStats();

      expect(redis.getJson).toHaveBeenCalledWith('mcdi:stats:cross-server');
      expect(result).toEqual({
        membersInMultipleServers: 42,
        overlaps: [
          {
            serverAId: 's1',
            serverAName: 'Main',
            serverBId: 's2',
            serverBName: 'Side',
            overlapCount: 18,
          },
        ],
      });
    });
  });

  describe('exportStats', () => {
    beforeEach(() => {
      repo.countMembers.mockResolvedValue(10);
      repo.countClubMembers.mockResolvedValue(5);
      repo.countActiveMembers.mockResolvedValue(8);
      repo.countNewMembers.mockResolvedValue(2);
    });

    it('exports members as JSON by default', async () => {
      const result = await service.exportStats({
        type: 'members',
        format: 'json',
        dateRange: '30d',
      } as any);
      expect(result.contentType).toBe('application/json');
      expect(result.filename).toMatch(
        /^stats-members-\d{4}-\d{2}-\d{2}\.json$/,
      );
      expect(JSON.parse(result.content)).toMatchObject({ totalMembers: 10 });
    });

    it('exports members as a single-row CSV', async () => {
      const result = await service.exportStats({
        type: 'members',
        format: 'csv',
        dateRange: '30d',
      } as any);
      expect(result.contentType).toBe('text/csv');
      expect(result.content).toContain('totalMembers');
      expect(result.content.split('\n')).toHaveLength(2); // header + 1 row
    });

    it('exports growth buckets as one CSV row per bucket', async () => {
      repo.countMembersBefore.mockResolvedValue(0);
      repo.memberGrowthBuckets.mockResolvedValue([
        { bucket: '2026-06-01', newMembers: 1 },
        { bucket: '2026-06-02', newMembers: 2 },
      ]);
      const result = await service.exportStats({
        type: 'growth',
        format: 'csv',
        dateRange: '30d',
      } as any);
      expect(result.content.split('\n')).toHaveLength(3); // header + 2 rows
    });

    it('exports roles as CSV when serverId is provided', async () => {
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
      const result = await service.exportStats({
        type: 'roles',
        format: 'csv',
        serverId: 's1',
        dateRange: '30d',
      } as any);
      expect(result.content).toContain('roleName');
    });

    it('rejects a roles export without serverId', async () => {
      await expect(
        service.exportStats({
          type: 'roles',
          format: 'csv',
          dateRange: '30d',
        } as any),
      ).rejects.toThrow('serverId is required');
    });

    it('exports servers as CSV', async () => {
      repo.listServers.mockResolvedValue([
        { serverId: 's1', serverName: 'Main' },
      ]);
      const result = await service.exportStats({
        type: 'servers',
        format: 'csv',
        dateRange: '30d',
      } as any);
      expect(result.content).toContain('serverId');
    });

    it('exports cross-server overlaps as CSV', async () => {
      repo.countMembersInMultipleServers.mockResolvedValue(1);
      repo.serverOverlapPairs.mockResolvedValue([
        {
          serverAId: 's1',
          serverAName: 'Main',
          serverBId: 's2',
          serverBName: 'Side',
          overlapCount: 1,
        },
      ]);
      const result = await service.exportStats({
        type: 'cross-server',
        format: 'csv',
        dateRange: '30d',
      } as any);
      expect(result.content).toContain('overlapCount');
    });
  });

  describe('daily refresh schedule', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('refreshDailySnapshot recomputes org-wide and per-server reports', async () => {
      repo.listServers.mockResolvedValue([
        { serverId: 's1', serverName: 'Main' },
        { serverId: 's2', serverName: 'Side' },
      ]);
      repo.countMembers.mockResolvedValue(0);
      repo.countClubMembers.mockResolvedValue(0);
      repo.countActiveMembers.mockResolvedValue(0);
      repo.countNewMembers.mockResolvedValue(0);
      repo.countMembersBefore.mockResolvedValue(0);
      repo.serverName.mockResolvedValue('Main');
      repo.countMembersInMultipleServers.mockResolvedValue(0);

      await service.refreshDailySnapshot();

      // 3 org-wide reports + 2 servers × 2 per-server reports = 7 cache writes
      expect(redis.setJson).toHaveBeenCalledTimes(7);
      expect(redis.setJson).toHaveBeenCalledWith(
        'mcdi:stats:members:all:30d',
        expect.any(Object),
        300000,
      );
      expect(redis.setJson).toHaveBeenCalledWith(
        'mcdi:stats:roles:s1',
        expect.any(Object),
        300000,
      );
      expect(redis.setJson).toHaveBeenCalledWith(
        'mcdi:stats:growth:s2:30d:daily',
        expect.any(Object),
        300000,
      );
    });

    it('bypasses a warm cache — force-refreshes regardless of a prior hit', async () => {
      redis.getJson.mockResolvedValue({ stale: true });
      repo.listServers.mockResolvedValue([]);
      repo.countMembers.mockResolvedValue(5);
      repo.countClubMembers.mockResolvedValue(0);
      repo.countActiveMembers.mockResolvedValue(0);
      repo.countNewMembers.mockResolvedValue(0);
      repo.countMembersInMultipleServers.mockResolvedValue(0);

      await service.refreshDailySnapshot();

      expect(redis.setJson).toHaveBeenCalledWith(
        'mcdi:stats:members:all:30d',
        expect.objectContaining({ totalMembers: 5 }),
        300000,
      );
    });

    it('does not throw when one report fails to recompute', async () => {
      repo.listServers.mockResolvedValue([]);
      repo.countMembers.mockRejectedValue(new Error('db down'));
      repo.countMembersInMultipleServers.mockResolvedValue(0);

      await expect(service.refreshDailySnapshot()).resolves.toBeUndefined();
    });

    it('start/stop schedule is idempotent and clears the interval', () => {
      jest.useFakeTimers();
      const setSpy = jest.spyOn(global, 'setInterval');
      const clearSpy = jest.spyOn(global, 'clearInterval');

      service.startDailyRefreshSchedule();
      service.startDailyRefreshSchedule(); // second call is a no-op
      expect(setSpy).toHaveBeenCalledTimes(1);

      service.stopDailyRefreshSchedule();
      expect(clearSpy).toHaveBeenCalledTimes(1);

      service.stopDailyRefreshSchedule(); // second call is a no-op
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache TTL override', () => {
    it('honours app.statsCacheTtlMs from config', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'app.statsCacheTtlMs' ? 60000 : undefined,
      );
      service = new StatsService(
        repo as any,
        redis as any,
        config as any,
        discord as any,
      );
      repo.countMembers.mockResolvedValue(0);
      repo.countClubMembers.mockResolvedValue(0);
      repo.countActiveMembers.mockResolvedValue(0);
      repo.countNewMembers.mockResolvedValue(0);

      await service.getMemberStats({ dateRange: '30d' });
      expect(redis.setJson).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        60000,
      );
    });
  });
});
