import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../../database/database.module';
import { CallbackCodeRepository } from './callback-code.repository';

function buildDb(finalValue: unknown = []) {
  function makeChain(): any {
    const chain: any = {};
    [
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
      'onConflictDoNothing',
    ].forEach((method) => {
      chain[method] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(finalValue);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }

  return {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  } as any;
}

async function buildRepo(db: any): Promise<CallbackCodeRepository> {
  const mod = await Test.createTestingModule({
    providers: [CallbackCodeRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();

  return mod.get(CallbackCodeRepository);
}

const fakeCode = (overrides: Record<string, unknown> = {}) => ({
  codeHash: 'a'.repeat(64),
  clientId: 'proj-1',
  redirectUri: 'https://app.example.com/callback',
  memberId: 'member-1',
  serverId: 'srv-1',
  expiresAt: new Date(Date.now() + 90_000),
  used: false,
  createdAt: new Date(),
  ...overrides,
});

describe('CallbackCodeRepository', () => {
  it('creates a callback code record', async () => {
    const code = fakeCode();
    const repo = await buildRepo(buildDb([code]));

    const result = await repo.create({
      codeHash: code.codeHash,
      clientId: 'proj-1',
      redirectUri: 'https://app.example.com/callback',
      memberId: 'member-1',
      serverId: 'srv-1',
      expiresAt: code.expiresAt,
    });

    expect(result).toEqual(code);
  });

  it('deletes expired callback codes', async () => {
    const db = buildDb([]);
    const repo = await buildRepo(db);

    await expect(repo.deleteExpired()).resolves.toBeUndefined();
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});