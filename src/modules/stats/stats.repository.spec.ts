import { StatsRepository } from './stats.repository';

function chain(result: unknown) {
  const c: any = {};
  [
    'from',
    'where',
    'innerJoin',
    'leftJoin',
    'groupBy',
    'orderBy',
    'limit',
  ].forEach((m) => {
    c[m] = jest.fn(() => c);
  });
  c.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej);
  return c;
}

function dbReturning(value: unknown) {
  return {
    select: jest.fn(() => chain(value)),
    selectDistinctOn: jest.fn(() => chain(value)),
  };
}

function repoWith(value: unknown): StatsRepository {
  return new StatsRepository(dbReturning(value) as any);
}

describe('StatsRepository', () => {
  describe('scalar counts', () => {
    it('countMembers returns the aggregate value (global and scoped)', async () => {
      expect(await repoWith([{ value: 1200 }]).countMembers()).toBe(1200);
      expect(await repoWith([{ value: 50 }]).countMembers('s1')).toBe(50);
    });

    it('countMembers defaults to 0 when no row comes back', async () => {
      expect(await repoWith([]).countMembers()).toBe(0);
    });

    it('countClubMembers handles global and scoped paths', async () => {
      expect(await repoWith([{ value: 800 }]).countClubMembers()).toBe(800);
      expect(await repoWith([{ value: 20 }]).countClubMembers('s1')).toBe(20);
    });

    it('countActiveMembers handles global (distinct) and scoped paths', async () => {
      expect(await repoWith([{ value: 1100 }]).countActiveMembers()).toBe(1100);
      expect(await repoWith([{ value: 40 }]).countActiveMembers('s1')).toBe(40);
    });

    it('countNewMembers handles global and scoped paths', async () => {
      const since = new Date('2026-06-01T00:00:00.000Z');
      expect(await repoWith([{ value: 45 }]).countNewMembers(since)).toBe(45);
      expect(await repoWith([{ value: 3 }]).countNewMembers(since, 's1')).toBe(
        3,
      );
    });

    it('countMembersBefore returns the baseline', async () => {
      expect(
        await repoWith([{ value: 1000 }]).countMembersBefore(new Date()),
      ).toBe(1000);
    });

    it('countDeparturesBefore returns departures baseline', async () => {
      expect(
        await repoWith([{ value: 50 }]).countDeparturesBefore(new Date()),
      ).toBe(50);
    });

    it('countServers returns the server total', async () => {
      expect(await repoWith([{ value: 4 }]).countServers()).toBe(4);
    });
  });

  describe('breakdowns', () => {
    it('membersByServer returns rows (with and without scope)', async () => {
      const rows = [{ serverId: 's1', serverName: 'Main', memberCount: 1200 }];
      expect(await repoWith(rows).membersByServer()).toEqual(rows);
      expect(await repoWith(rows).membersByServer('s1')).toEqual(rows);
    });

    it('membersByRole returns rows (with and without scope)', async () => {
      const rows = [{ roleName: 'Member', count: 800 }];
      expect(await repoWith(rows).membersByRole()).toEqual(rows);
      expect(await repoWith(rows).membersByRole('s1')).toEqual(rows);
    });

    it('memberGrowthBuckets returns buckets for the chosen unit', async () => {
      const rows = [{ bucket: '2026-06-01T00:00:00.000Z', newMembers: 12 }];
      expect(
        await repoWith(rows).memberGrowthBuckets(new Date(), 'day'),
      ).toEqual(rows);
    });

    it('memberDepartureBuckets returns departure buckets for the chosen unit', async () => {
      const rows = [{ bucket: '2026-06-01T00:00:00.000Z', leftMembers: 5 }];
      expect(
        await repoWith(rows).memberDepartureBuckets(new Date(), 'day'),
      ).toEqual(rows);
    });

    it('roleDistribution returns per-role counts', async () => {
      const rows = [
        {
          roleId: 'r1',
          roleName: 'Member',
          hierarchyLevel: 1,
          color: 123,
          memberCount: 800,
        },
      ];
      expect(await repoWith(rows).roleDistribution('s1')).toEqual(rows);
    });
  });

  describe('server overview', () => {
    it('serverName returns the name or null', async () => {
      expect(await repoWith([{ name: 'Main' }]).serverName('s1')).toBe('Main');
      expect(await repoWith([]).serverName('s1')).toBeNull();
    });

    it('listServers returns id/name rows', async () => {
      const rows = [{ serverId: 's1', serverName: 'Main' }];
      expect(await repoWith(rows).listServers()).toEqual(rows);
    });

    it('memberCountsByServer returns grouped counts', async () => {
      const rows = [{ serverId: 's1', memberCount: 1200, activeMembers: 1100 }];
      expect(await repoWith(rows).memberCountsByServer()).toEqual(rows);
    });

    it('roleCountsByServer returns grouped counts', async () => {
      const rows = [{ serverId: 's1', roleCount: 15 }];
      expect(await repoWith(rows).roleCountsByServer()).toEqual(rows);
    });

    it('latestSyncByServer uses distinct-on and returns latest rows', async () => {
      const rows = [
        { serverId: 's1', status: 'success', finishedAt: new Date() },
      ];
      const db = dbReturning(rows);
      const repo = new StatsRepository(db as any);
      expect(await repo.latestSyncByServer()).toEqual(rows);
      expect(db.selectDistinctOn).toHaveBeenCalled();
    });
  });
});
