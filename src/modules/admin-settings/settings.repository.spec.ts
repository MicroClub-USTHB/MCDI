import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../database/database.module';
import { SettingsRepository } from './settings.repository';

/** All chained calls resolve to `finalValue`. */
function buildDb(finalValue: unknown = []) {
  function makeChain(): any {
    const chain: any = {};
    ['from', 'where', 'limit', 'values', 'onConflictDoUpdate'].forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(finalValue);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }
  return {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
  };
}

async function buildRepo(db: unknown) {
  const moduleRef = await Test.createTestingModule({
    providers: [SettingsRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return moduleRef.get(SettingsRepository);
}

const storedRow = {
  id: 1,
  permissionCacheTtlMs: 600_000,
  statsCacheTtlMs: null,
  memberActivityThresholdDays: null,
  maxWebhooksPerProject: null,
  updatedAt: new Date(),
  updatedBy: 'admin-1',
};

describe('SettingsRepository', () => {
  it('find() returns the singleton row', async () => {
    const repo = await buildRepo(buildDb([storedRow]));
    await expect(repo.find()).resolves.toEqual(storedRow);
  });

  it('find() returns null before the row exists', async () => {
    const repo = await buildRepo(buildDb([]));
    await expect(repo.find()).resolves.toBeNull();
  });

  it('upsert() writes id=1 with the patch and returns the row', async () => {
    const db = buildDb([storedRow]);
    const repo = await buildRepo(db);
    const result = await repo.upsert(
      { permissionCacheTtlMs: 600_000 },
      'admin-1',
    );
    expect(db.insert).toHaveBeenCalledTimes(1);
    const values = db.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(values).toMatchObject({
      id: 1,
      permissionCacheTtlMs: 600_000,
      updatedBy: 'admin-1',
    });
    expect(result).toEqual(storedRow);
  });

  it('reset() nulls every knob column', async () => {
    const db = buildDb([{ ...storedRow, permissionCacheTtlMs: null }]);
    const repo = await buildRepo(db);
    await repo.reset('admin-1');
    const values = db.insert.mock.results[0].value.values.mock.calls[0][0];
    expect(values).toMatchObject({
      permissionCacheTtlMs: null,
      statsCacheTtlMs: null,
      memberActivityThresholdDays: null,
      maxWebhooksPerProject: null,
      updatedBy: 'admin-1',
    });
  });
});
