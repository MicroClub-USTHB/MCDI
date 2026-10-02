import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisService } from './redis.service';

jest.mock('redis', () => ({
  createClient: jest.fn(),
}));

type MockRedisClient = {
  connect: jest.Mock;
  quit: jest.Mock;
  disconnect: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  sAdd: jest.Mock;
  sMembers: jest.Mock;
  expire: jest.Mock;
  info: jest.Mock;
  scanIterator: jest.Mock;
  on: jest.Mock;
  isReady: boolean;
  isOpen: boolean;
};

const mockCreateClient = createClient as jest.MockedFunction<
  typeof createClient
>;

function makeAsyncIterable(values: string[]) {
  return {
    *[Symbol.asyncIterator]() {
      for (const value of values) {
        yield value;
      }
    },
  };
}

function makeClient(): MockRedisClient {
  const handlers = new Map<string, (...args: unknown[]) => void>();

  const client: MockRedisClient = {
    connect: jest.fn().mockImplementation(() => {
      client.isOpen = true;
      client.isReady = true;
      return Promise.resolve();
    }),
    quit: jest.fn().mockImplementation(() => {
      client.isOpen = false;
      client.isReady = false;
      return Promise.resolve();
    }),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    sAdd: jest.fn(),
    sMembers: jest.fn(),
    expire: jest.fn(),
    info: jest.fn(),
    scanIterator: jest.fn().mockReturnValue(makeAsyncIterable([])),
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return client;
    }),
    isReady: false,
    isOpen: false,
  };

  (
    client as MockRedisClient & {
      emit?: (event: string, payload: unknown) => void;
    }
  ).emit = (event: string, payload: unknown) => {
    handlers.get(event)?.(payload);
  };

  return client;
}

async function buildService(
  config: Record<string, unknown> = {},
  client = makeClient(),
) {
  mockCreateClient.mockReturnValue(client as never);

  const module = await Test.createTestingModule({
    providers: [
      RedisService,
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn((key: string) => config[key]),
        },
      },
    ],
  }).compile();

  return {
    service: module.get(RedisService),
    client,
  };
}

describe('RedisService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a client from redis.url when provided', async () => {
    await buildService({ 'redis.url': 'redis://cache:6379' });

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'redis://cache:6379',
    });
  });

  it('creates a client from host/port settings when redis.url is absent', async () => {
    await buildService({
      'redis.host': 'redis',
      'redis.port': 6380,
      'redis.password': 'secret',
      'redis.database': 2,
    });

    expect(mockCreateClient).toHaveBeenCalledWith({
      socket: {
        host: 'redis',
        port: 6380,
        reconnectStrategy: expect.any(Function),
      },
      password: 'secret',
      database: 2,
    });
  });

  it('connects on module init and quits on module destroy', async () => {
    const { service, client } = await buildService();

    service.onModuleInit();
    expect(client.connect).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it('disconnects when quit fails during module destroy', async () => {
    const client = makeClient();
    client.isOpen = true;
    client.isReady = true;
    client.quit.mockRejectedValue(new Error('quit failed'));

    const { service } = await buildService({}, client);
    await service.onModuleDestroy();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects immediately when the client is open but not ready', async () => {
    const client = makeClient();
    client.isOpen = true;
    client.isReady = false;

    const { service } = await buildService({}, client);
    await service.onModuleDestroy();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
    expect(client.quit).not.toHaveBeenCalled();
  });

  it('returns parsed JSON values from getJson', async () => {
    const client = makeClient();
    client.isReady = true;
    client.get.mockResolvedValue(JSON.stringify({ ok: true }));

    const { service } = await buildService({}, client);
    await expect(service.getJson<{ ok: boolean }>('k')).resolves.toEqual({
      ok: true,
    });
  });

  it('returns null from getJson when the payload is invalid JSON', async () => {
    const client = makeClient();
    client.isReady = true;
    client.get.mockResolvedValue('{bad json');

    const { service } = await buildService({}, client);
    await expect(service.getJson('k')).resolves.toBeNull();
  });

  it('stores JSON values with PX ttl', async () => {
    const client = makeClient();
    client.isReady = true;

    const { service } = await buildService({}, client);
    await service.setJson('k', { ok: true }, 5000);

    expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ ok: true }), {
      PX: 5000,
    });
  });

  it('returns true from setNx when Redis returns OK', async () => {
    const client = makeClient();
    client.isReady = true;
    client.set.mockResolvedValue('OK');

    const { service } = await buildService({}, client);
    await expect(service.setNx('k', '1', 1000)).resolves.toBe(true);
  });

  it('returns scanned keys from scanKeys', async () => {
    const client = makeClient();
    client.isReady = true;
    client.scanIterator.mockReturnValue(makeAsyncIterable(['a', 'b']));

    const { service } = await buildService({}, client);
    await expect(service.scanKeys('mcdi:*')).resolves.toEqual(['a', 'b']);
  });

  it('returns the raw INFO payload for the requested section', async () => {
    const client = makeClient();
    client.isReady = true;
    client.info.mockResolvedValue('# Stats\r\nkeyspace_hits:12\r\n');

    const { service } = await buildService({}, client);
    await expect(service.info('stats')).resolves.toBe(
      '# Stats\r\nkeyspace_hits:12\r\n',
    );
    expect(client.info).toHaveBeenCalledWith('stats');
  });

  it('returns safe fallbacks when the client is not ready', async () => {
    const { service, client } = await buildService();
    client.isReady = false;

    await expect(service.getJson('k')).resolves.toBeNull();
    await expect(service.setNx('k', '1', 10)).resolves.toBe(false);
    await expect(service.delete('a')).resolves.toBe(0);
    await expect(service.sMembers('set')).resolves.toEqual([]);
    await expect(service.scanKeys('mcdi:*')).resolves.toEqual([]);
    await expect(service.info('stats')).resolves.toBeNull();
  });
});
