import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PermissionCacheService } from './permission-cache.service';

async function buildService() {
  const mod = await Test.createTestingModule({
    providers: [
      PermissionCacheService,
      {
        provide: ConfigService,
        useValue: { get: jest.fn().mockReturnValue(5 * 60 * 1000) },
      },
    ],
  }).compile();
  return mod.get(PermissionCacheService);
}

const fakeEntry = (
  overrides: Partial<{
    permissions: string[];
    sources: {
      global: string[];
      server: string[];
      hierarchy: string[];
      inherited: string[];
    };
  }> = {},
) => ({
  permissions: ['READ_MEMBERS', 'WRITE_ROLES'],
  sources: {
    global: [],
    server: ['READ_MEMBERS'],
    hierarchy: [],
    inherited: ['WRITE_ROLES'],
  },
  ...overrides,
});

describe('PermissionCacheService', () => {
  describe('get — cache miss', () => {
    it('returns null when no entry exists for (memberId, serverId)', async () => {
      const svc = await buildService();
      expect(svc.get('mem-1', 'srv-1')).toBeNull();
    });
  });

  describe('set & get', () => {
    it('caches and retrieves permissions for a member/server pair', async () => {
      const svc = await buildService();
      const entry = fakeEntry();
      svc.set('mem-1', 'srv-1', entry);

      const result = svc.get('mem-1', 'srv-1')!;
      expect(result).not.toBeNull();
      expect(result.permissions).toEqual(['READ_MEMBERS', 'WRITE_ROLES']);
      expect(result.sources.server).toEqual(['READ_MEMBERS']);
    });

    it('stores different entries per member/server combination', async () => {
      const svc = await buildService();
      svc.set('mem-1', 'srv-1', fakeEntry({ permissions: ['A'] }));
      svc.set('mem-2', 'srv-1', fakeEntry({ permissions: ['B'] }));

      expect(svc.get('mem-1', 'srv-1')!.permissions).toEqual(['A']);
      expect(svc.get('mem-2', 'srv-1')!.permissions).toEqual(['B']);
    });

    it('size() reflects number of cached entries', async () => {
      const svc = await buildService();
      expect(svc.size()).toBe(0);
      svc.set('mem-1', 'srv-1', fakeEntry());
      expect(svc.size()).toBe(1);
      svc.set('mem-2', 'srv-1', fakeEntry());
      expect(svc.size()).toBe(2);
    });
  });

  describe('get — expired entry', () => {
    it('returns null and removes the entry when TTL has elapsed', async () => {
      const svc = await buildService();
      svc.set('mem-1', 'srv-1', fakeEntry());

      // Manually expire the entry by patching the internal store
      const store: Map<string, any> = (svc as any).store;
      const key = 'mem-1:srv-1';
      const entry = store.get(key)!;
      store.set(key, { ...entry, expiresAt: Date.now() - 1 });

      expect(svc.get('mem-1', 'srv-1')).toBeNull();
      expect(svc.size()).toBe(0); // entry was removed
    });
  });

  describe('invalidateMember', () => {
    it('removes all entries for a given memberId across all servers', async () => {
      const svc = await buildService();
      svc.set('mem-1', 'srv-1', fakeEntry());
      svc.set('mem-1', 'srv-2', fakeEntry());
      svc.set('mem-2', 'srv-1', fakeEntry());

      svc.invalidateMember('mem-1');

      expect(svc.get('mem-1', 'srv-1')).toBeNull();
      expect(svc.get('mem-1', 'srv-2')).toBeNull();
      expect(svc.get('mem-2', 'srv-1')).not.toBeNull(); // unaffected
      expect(svc.size()).toBe(1);
    });

    it('does nothing when no entries exist for the member', async () => {
      const svc = await buildService();
      svc.set('mem-2', 'srv-1', fakeEntry());
      expect(() => svc.invalidateMember('mem-1')).not.toThrow();
      expect(svc.size()).toBe(1);
    });
  });

  describe('invalidateServer', () => {
    it('removes all entries for a given serverId across all members', async () => {
      const svc = await buildService();
      svc.set('mem-1', 'srv-1', fakeEntry());
      svc.set('mem-2', 'srv-1', fakeEntry());
      svc.set('mem-1', 'srv-2', fakeEntry());

      svc.invalidateServer('srv-1');

      expect(svc.get('mem-1', 'srv-1')).toBeNull();
      expect(svc.get('mem-2', 'srv-1')).toBeNull();
      expect(svc.get('mem-1', 'srv-2')).not.toBeNull(); // unaffected
      expect(svc.size()).toBe(1);
    });

    it('does nothing when no entries exist for the server', async () => {
      const svc = await buildService();
      expect(() => svc.invalidateServer('srv-x')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('flushes all entries from the cache', async () => {
      const svc = await buildService();
      svc.set('mem-1', 'srv-1', fakeEntry());
      svc.set('mem-2', 'srv-2', fakeEntry());
      expect(svc.size()).toBe(2);

      svc.clear();
      expect(svc.size()).toBe(0);
      expect(svc.get('mem-1', 'srv-1')).toBeNull();
    });

    it('does not throw when store is already empty', async () => {
      const svc = await buildService();
      expect(() => svc.clear()).not.toThrow();
    });
  });
});
