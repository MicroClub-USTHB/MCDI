import { Test } from '@nestjs/testing';
import { OAuthClientRepository } from './oauth-client.repository';
import { DRIZZLE } from '../../../database/database.module';

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
    ].forEach((m) => {
      chain[m] = jest.fn().mockReturnValue(chain);
    });
    chain.returning = jest.fn().mockResolvedValue(finalValue);
    chain.then = (resolve: any, reject?: any) =>
      Promise.resolve(finalValue).then(resolve, reject);
    return chain;
  }
  const db: any = {
    select: jest.fn().mockImplementation(makeChain),
    insert: jest.fn().mockImplementation(makeChain),
    update: jest.fn().mockImplementation(makeChain),
    delete: jest.fn().mockImplementation(makeChain),
  };
  return db;
}

async function buildRepo(db: any): Promise<OAuthClientRepository> {
  const mod = await Test.createTestingModule({
    providers: [OAuthClientRepository, { provide: DRIZZLE, useValue: db }],
  }).compile();
  return mod.get(OAuthClientRepository);
}

const fakeClient = (overrides: Record<string, unknown> = {}) => ({
  id: 'oc-uuid-1',
  clientId: 'client-abc',
  clientSecret: 'secret-xyz',
  name: 'My App',
  redirectUris: ['https://app.example.com/cb'],
  active: true,
  createdAt: new Date(),
  ...overrides,
});

describe('OAuthClientRepository', () => {
  describe('findByClientId', () => {
    it('returns client when found', async () => {
      const client = fakeClient();
      const db = buildDb([client]);
      const repo = await buildRepo(db);
      expect(await repo.findByClientId('client-abc')).toEqual(client);
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByClientId('ghost')).toBeNull();
    });
  });

  describe('findByClientIdAndSecret', () => {
    it('returns client for matching id and secret', async () => {
      const client = fakeClient();
      const db = buildDb([client]);
      const repo = await buildRepo(db);
      expect(
        await repo.findByClientIdAndSecret('client-abc', 'secret-xyz'),
      ).toEqual(client);
    });

    it('returns null when credentials do not match', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findByClientIdAndSecret('bad', 'bad')).toBeNull();
    });
  });

  describe('findActiveByClientId', () => {
    it('returns active client', async () => {
      const client = fakeClient();
      const db = buildDb([client]);
      const repo = await buildRepo(db);
      expect(await repo.findActiveByClientId('client-abc')).toEqual(client);
    });

    it('returns null for inactive / missing client', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.findActiveByClientId('ghost')).toBeNull();
    });
  });

  describe('create', () => {
    it('inserts and returns the new client', async () => {
      const client = fakeClient();
      const db = buildDb([client]);
      const repo = await buildRepo(db);
      const result = await repo.create({
        clientId: 'client-abc',
        clientSecret: 'secret-xyz',
        name: 'My App',
        redirectUris: ['https://app.example.com/cb'],
      });
      expect(result).toEqual(client);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('returns updated client', async () => {
      const updated = fakeClient({ name: 'My App v2' });
      const db = buildDb([updated]);
      const repo = await buildRepo(db);
      const result = await repo.update('client-abc', { name: 'My App v2' });
      expect(result).toMatchObject({ name: 'My App v2' });
    });

    it('returns null when client not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.update('ghost', { name: 'x' })).toBeNull();
    });
  });

  describe('delete', () => {
    it('calls delete without error', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      await expect(repo.delete('client-abc')).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('returns list of clients', async () => {
      const clients = [fakeClient()];
      const db = buildDb(clients);
      const repo = await buildRepo(db);
      expect(await repo.findAll()).toEqual(clients);
    });
  });

  describe('setActive', () => {
    it('returns updated client', async () => {
      const client = fakeClient({ active: false });
      const db = buildDb([client]);
      const repo = await buildRepo(db);
      const result = await repo.setActive('client-abc', false);
      expect(result).toMatchObject({ active: false });
    });

    it('returns null when not found', async () => {
      const db = buildDb([]);
      const repo = await buildRepo(db);
      expect(await repo.setActive('ghost', true)).toBeNull();
    });
  });
});
