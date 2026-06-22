import { Test } from '@nestjs/testing';
import { SyncRepository } from './sync.repository';
import { DRIZZLE } from '../../database/database.module';

// ── Drizzle chain mock factory ─────────────────────────────────────────────
//
// db itself is NOT thenable (prevents NestJS DI from resolving it as a Promise).
// Each db.select() / db.insert() / db.update() / db.delete() returns a
// fresh thenable chain so all query terminal patterns work:
//   .limit()               → hits thenable .then()
//   .limit().offset()      → hits thenable .then()
//   .where() (no limit)    → hits thenable .then()
//   .returning()           → explicit Promise terminal for mutations
//
function buildDb(finalValue: unknown = []) {
  function makeChain(): any {
    const chain: any = {};
    const builderMethods = [
      'from',
      'where',
      'orderBy',
      'innerJoin',
      'leftJoin',
      'set',
      'limit',
      'offset',
      'values',
      'onConflictDoUpdate',
      'groupBy',
      'having',
    ];
    builderMethods.forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(finalValue);
    chain.then = (
      resolve: (v: unknown) => void,
      reject?: (e: unknown) => void,
    ) => Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }
  const db: any = {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  };
  db.transaction = jest.fn().mockImplementation((callback) => callback(db));
  return db;
}

async function buildRepo(db: any): Promise<SyncRepository> {
  const module = await Test.createTestingModule({
    providers: [SyncRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return module.get(SyncRepository);
}

const fakeLog = (overrides = {}) => ({
  id: 1,
  serverId: 'guild-1',
  syncType: 'manual',
  status: 'in_progress',
  target: 'all',
  membersSynced: 0,
  rolesSynced: 0,
  startedAt: new Date(),
  heartbeatAt: null,
  finishedAt: null,
  message: null,
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SyncRepository', () => {
  // ── createLog ────────────────────────────────────────────────────────────

  describe('createLog', () => {
    it('inserts a new log and returns the created row', async () => {
      const log = fakeLog();
      const db = buildDb([log]);
      const repo = await buildRepo(db);

      const result = await repo.createLog(
        'guild-1',
        'manual',
        'in_progress',
        new Date(),
      );
      expect(db.insert).toHaveBeenCalled();
      expect(result).toEqual(log);
    });
  });

  // ── updateLog ────────────────────────────────────────────────────────────

  describe('updateLog', () => {
    it('updates an existing log and returns updated row', async () => {
      const updated = fakeLog({ status: 'success', membersSynced: 10 });
      const db = buildDb([updated]);
      const repo = await buildRepo(db);

      const result = await repo.updateLog(1, {
        status: 'success',
        membersSynced: 10,
      });
      expect(db.update).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('returns null when the log is not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.updateLog(999, { status: 'failed' });
      expect(result).toBeNull();
    });

    it('uses provided finishedAt when given', async () => {
      const finishedAt = new Date();
      const updated = fakeLog({ status: 'success', finishedAt });
      const db = buildDb([updated]);
      const repo = await buildRepo(db);
      const result = await repo.updateLog(1, { status: 'success', finishedAt });
      expect(result).toEqual(updated);
    });
  });

  // ── getInProgressLog ─────────────────────────────────────────────────────

  describe('getInProgressLog', () => {
    it('returns the in-progress log when one exists', async () => {
      const log = fakeLog();
      const db = buildDb([log]);
      const repo = await buildRepo(db);
      const result = await repo.getInProgressLog('guild-1');
      expect(result).toEqual(log);
    });

    it('returns null when no in-progress log exists', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.getInProgressLog('guild-1');
      expect(result).toBeNull();
    });
  });

  // ── getActiveLog ─────────────────────────────────────────────────────────

  describe('getActiveLog', () => {
    it('returns a queued log when one exists', async () => {
      const log = fakeLog({ status: 'queued' });
      const db = buildDb([log]);
      const repo = await buildRepo(db);
      const result = await repo.getActiveLog('guild-1');
      expect(result).toEqual(log);
    });

    it('returns null when no queued or in-progress log exists', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.getActiveLog('guild-1');
      expect(result).toBeNull();
    });
  });

  // ── claimNextRunnableLog ────────────────────────────────────────────────

  describe('claimNextRunnableLog', () => {
    it('claims the next queued log and stamps heartbeat data', async () => {
      const queued = fakeLog({ id: 11, status: 'queued' });
      const claimedAt = new Date('2026-03-22T10:00:00.000Z');
      const claimed = fakeLog({
        id: 11,
        status: 'in_progress',
        startedAt: claimedAt,
        heartbeatAt: claimedAt,
      });
      const db = buildDb([queued]);
      db.update = jest.fn().mockImplementation(() => {
        const chain: any = {};
        chain.set = jest.fn().mockReturnValue(chain);
        chain.where = jest.fn().mockReturnValue(chain);
        chain.returning = jest.fn().mockResolvedValue([claimed]);
        return chain;
      });
      db.transaction = jest.fn().mockImplementation((callback) => callback(db));

      const repo = await buildRepo(db);
      const result = await repo.claimNextRunnableLog(
        new Date('2026-03-22T09:55:00.000Z'),
        claimedAt,
      );

      expect(result).toEqual(claimed);
      expect(db.transaction).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('returns null when another worker already claimed the selected log', async () => {
      const queued = fakeLog({ id: 12, status: 'queued' });
      const db = buildDb([queued]);
      db.update = jest.fn().mockImplementation(() => {
        const chain: any = {};
        chain.set = jest.fn().mockReturnValue(chain);
        chain.where = jest.fn().mockReturnValue(chain);
        chain.returning = jest.fn().mockResolvedValue([]);
        return chain;
      });
      db.transaction = jest.fn().mockImplementation((callback) => callback(db));

      const repo = await buildRepo(db);
      const result = await repo.claimNextRunnableLog(new Date());

      expect(result).toBeNull();
    });
  });

  // ── touchHeartbeat ──────────────────────────────────────────────────────

  describe('touchHeartbeat', () => {
    it('updates heartbeatAt for an existing log', async () => {
      const heartbeatAt = new Date('2026-03-22T10:10:00.000Z');
      const updated = fakeLog({ heartbeatAt });
      const db = buildDb([updated]);
      const repo = await buildRepo(db);

      const result = await repo.touchHeartbeat(1, heartbeatAt);
      expect(result).toEqual(updated);
    });
  });

  // ── getLatestLog ──────────────────────────────────────────────────────────

  describe('getLatestLog', () => {
    it('returns the latest log when found', async () => {
      const log = fakeLog({ status: 'success' });
      const db = buildDb([log]);
      const repo = await buildRepo(db);
      const result = await repo.getLatestLog('guild-1');
      expect(result).toEqual(log);
    });

    it('returns null when no log exists', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.getLatestLog('guild-1');
      expect(result).toBeNull();
    });
  });

  // ── getLogs / countLogs ──────────────────────────────────────────────────

  describe('getLogs', () => {
    it('returns paginated logs for a server', async () => {
      const logs = [fakeLog({ id: 1 }), fakeLog({ id: 2 })];
      const db = buildDb(logs);
      const repo = await buildRepo(db);
      const result = await repo.getLogs('guild-1', 20, 0);
      expect(result).toEqual(logs);
    });
  });

  describe('countLogs', () => {
    it('returns the count of logs for a server', async () => {
      const db = buildDb([{ count: 5 }]);
      const repo = await buildRepo(db);
      const result = await repo.countLogs('guild-1');
      expect(result).toBe(5);
    });

    it('returns 0 when there are no logs', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.countLogs('guild-1');
      expect(result).toBe(0);
    });
  });

  // ── createChangeDetail ───────────────────────────────────────────────────

  describe('createChangeDetail', () => {
    it('inserts a single change detail and returns the row', async () => {
      const detail = {
        id: 1,
        syncLogId: 1,
        serverId: 'guild-1',
        entityType: 'member',
        entityId: 'user-1',
        action: 'added',
        description: 'Member joined',
        details: null,
        createdAt: new Date(),
      };
      const db = buildDb([detail]);
      const repo = await buildRepo(db);

      const result = await repo.createChangeDetail({
        syncLogId: 1,
        serverId: 'guild-1',
        entityType: 'member',
        entityId: 'user-1',
        action: 'added',
        description: 'Member joined',
      });
      expect(result).toEqual(detail);
    });
  });

  // ── createChangeDetails (batch) ──────────────────────────────────────────

  describe('createChangeDetails', () => {
    it('does nothing when items array is empty', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await repo.createChangeDetails([]);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('inserts all items when array is non-empty', async () => {
      const items = [
        {
          syncLogId: 1,
          serverId: 'g1',
          entityType: 'member',
          entityId: 'u1',
          action: 'added',
        },
        {
          syncLogId: 1,
          serverId: 'g1',
          entityType: 'role',
          entityId: 'r1',
          action: 'updated',
        },
      ];
      const db = buildDb(undefined);
      const repo = await buildRepo(db);

      await repo.createChangeDetails(items);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  // ── getChangeDetails / countChangeDetails ────────────────────────────────

  describe('getChangeDetails', () => {
    it('returns paginated change details for a sync log', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      const result = await repo.getChangeDetails(1, 100, 0);
      expect(result).toEqual(rows);
    });

    it('applies offset correctly for non-zero offset', async () => {
      const rows = [{ id: 3 }];
      const db = buildDb(rows);
      const repo = await buildRepo(db);
      const result = await repo.getChangeDetails(1, 50, 100);
      expect(result).toEqual(rows);
    });
  });

  describe('countChangeDetails', () => {
    it('returns the count of change details for a sync log', async () => {
      const db = buildDb([{ count: 42 }]);
      const repo = await buildRepo(db);
      const result = await repo.countChangeDetails(1);
      expect(result).toBe(42);
    });

    it('returns 0 when no change details exist', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      const result = await repo.countChangeDetails(1);
      expect(result).toBe(0);
    });
  });
});
