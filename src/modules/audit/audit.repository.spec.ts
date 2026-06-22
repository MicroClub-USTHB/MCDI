import { Test } from '@nestjs/testing';
import { AuditRepository } from './audit.repository';
import { DRIZZLE } from '../../database/database.module';

function thenableChain(value: unknown) {
  const chain: any = {};
  ['from', 'where', 'orderBy', 'limit', 'offset'].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve(value).then(resolve, reject);
  return chain;
}

async function buildRepo(db: any): Promise<AuditRepository> {
  const mod = await Test.createTestingModule({
    providers: [AuditRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(AuditRepository);
}

describe('AuditRepository', () => {
  afterEach(() => jest.clearAllMocks());

  describe('insert', () => {
    it('applies defaults for omitted optional fields', async () => {
      const values = jest.fn().mockResolvedValue(undefined);
      const db = { insert: jest.fn().mockReturnValue({ values }) };
      const repo = await buildRepo(db);

      await repo.insert({
        actionType: 'auth',
        action: 'login',
        entityType: 'session',
      });

      expect(values).toHaveBeenCalledWith({
        actorId: null,
        actorName: null,
        actionType: 'auth',
        action: 'login',
        entityType: 'session',
        entityId: null,
        details: null,
        ipAddress: null,
        userAgent: null,
        severity: 'info',
      });
    });

    it('passes through provided values', async () => {
      const values = jest.fn().mockResolvedValue(undefined);
      const db = { insert: jest.fn().mockReturnValue({ values }) };
      const repo = await buildRepo(db);

      await repo.insert({
        actorId: 'm1',
        actorName: 'admin',
        actionType: 'project',
        action: 'created',
        entityType: 'project',
        entityId: 'p1',
        details: { a: 1 },
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
        severity: 'warning',
      });

      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'm1',
          severity: 'warning',
          details: { a: 1 },
        }),
      );
    });
  });

  describe('findPaginated', () => {
    it('queries with no WHERE clause when no filters are set', async () => {
      const countChain = thenableChain([{ value: 3 }]);
      const rowsChain = thenableChain([{ id: 1 }, { id: 2 }, { id: 3 }]);
      const db = {
        select: jest
          .fn()
          .mockReturnValueOnce(countChain)
          .mockReturnValueOnce(rowsChain),
      };
      const repo = await buildRepo(db);

      const result = await repo.findPaginated({ limit: 50, offset: 0 });

      expect(result.total).toBe(3);
      expect(result.rows).toHaveLength(3);
      expect(countChain.where).toHaveBeenCalledWith(undefined);
      expect(rowsChain.limit).toHaveBeenCalledWith(50);
      expect(rowsChain.offset).toHaveBeenCalledWith(0);
    });

    it('builds a combined WHERE clause when all filters are set', async () => {
      const countChain = thenableChain([{ value: 1 }]);
      const rowsChain = thenableChain([{ id: 9 }]);
      const db = {
        select: jest
          .fn()
          .mockReturnValueOnce(countChain)
          .mockReturnValueOnce(rowsChain),
      };
      const repo = await buildRepo(db);

      const result = await repo.findPaginated({
        dateFrom: '2026-03-01T00:00:00Z',
        dateTo: '2026-04-01T00:00:00Z',
        actorId: 'm1',
        actionType: 'project',
        severity: 'error',
        limit: 10,
        offset: 5,
      });

      expect(result.total).toBe(1);
      expect(countChain.where).toHaveBeenCalledWith(expect.anything());
      expect(countChain.where.mock.calls[0][0]).toBeDefined();
    });

    it('defaults total to 0 when the count query returns nothing', async () => {
      const countChain = thenableChain([]);
      const rowsChain = thenableChain([]);
      const db = {
        select: jest
          .fn()
          .mockReturnValueOnce(countChain)
          .mockReturnValueOnce(rowsChain),
      };
      const repo = await buildRepo(db);

      const result = await repo.findPaginated({ limit: 50, offset: 0 });
      expect(result.total).toBe(0);
    });
  });

  describe('deleteOlderThan', () => {
    it('returns the number of purged rows', async () => {
      const returning = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const where = jest.fn().mockReturnValue({ returning });
      const db = { delete: jest.fn().mockReturnValue({ where }) };
      const repo = await buildRepo(db);

      const deleted = await repo.deleteOlderThan(
        new Date('2026-01-01T00:00:00Z'),
      );

      expect(deleted).toBe(2);
      expect(where).toHaveBeenCalled();
    });
  });
});
