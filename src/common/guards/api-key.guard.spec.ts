import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ApiKeyGuard } from './api-key.guard';
import { DRIZZLE } from '../../database/database.module';
import { ProjectsService } from '../../modules/projects/projects.service';
import { ProjectAuthCacheService } from '../../modules/projects/project-auth-cache.service';

// ── Fixtures ───────────────────────────────────────────────────────────────

const ACTIVE_PROJECT = {
  id: 'project-1',
  name: 'Test Project',
  apiKeyPrefix: 'pk_aabbccdd',
  apiKeyHash: '', // will be set per test
  isActive: true,
};

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    headers: {},
    query: {},
    params: {},
    ...overrides,
  };
}

function makeContext(
  request: any,
  handlerMetadata: Record<string, any> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({ metadata: handlerMetadata }),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

// ── Setup ──────────────────────────────────────────────────────────────────

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockDb: any;
  let mockReflector: jest.Mocked<Reflector>;
  let mockAccessService: jest.Mocked<ProjectsService>;
  let mockProjectAuthCache: jest.Mocked<ProjectAuthCacheService>;

  const setupGuard = async (projectRows: any[]) => {
    let dbSelectCallIdx = 0;
    const selectResults = [projectRows];
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(selectResults[dbSelectCallIdx++] ?? []),
        ),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockReflector = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn().mockReturnValue('READ'),
    } as any;

    mockAccessService = {
      assertProjectServerRequestAccess: jest.fn().mockResolvedValue(undefined),
    } as any;

    const cacheStore = new Map<string, any>();
    mockProjectAuthCache = {
      get: jest.fn((apiKey: string) => cacheStore.get(apiKey) ?? null),
      set: jest.fn((apiKey: string, project: any) => {
        cacheStore.set(apiKey, project);
      }),
      shouldRefreshLastUsed: jest.fn().mockResolvedValue(false),
      invalidateProject: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
      size: jest.fn().mockResolvedValue(cacheStore.size),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: Reflector, useValue: mockReflector },
        { provide: ProjectsService, useValue: mockAccessService },
        { provide: ProjectAuthCacheService, useValue: mockProjectAuthCache },
      ],
    }).compile();

    return module.get(ApiKeyGuard);
  };

  // ── Missing API key ──

  it('throws UnauthorizedException when no API key is in the request', async () => {
    guard = await setupGuard([]);
    const ctx = makeContext(makeRequest());
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ── Invalid API key ──

  it('throws UnauthorizedException when the API key does not match any project', async () => {
    guard = await setupGuard([]); // empty DB result
    const ctx = makeContext(
      makeRequest({
        headers: { authorization: 'Bearer pk_bad.invalidsecret' },
      }),
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when API key has wrong format (no dot)', async () => {
    guard = await setupGuard([]);
    const ctx = makeContext(
      makeRequest({ headers: { authorization: 'Bearer nodotinkey' } }),
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  // ── Invalid server ID ──

  it('throws BadRequestException when serverId is not a valid Discord snowflake', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();

    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };
    let idx = 0;
    const results = [[project]];
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockImplementation(() => Promise.resolve(results[idx++] ?? [])),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    const reflector: any = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn().mockReturnValue('READ'),
    };
    const accessSvc: any = {
      assertProjectServerRequestAccess: jest.fn(),
    };
    const cacheStore = new Map<string, any>();
    const authCache: any = {
      get: jest.fn((apiKey: string) => cacheStore.get(apiKey) ?? null),
      set: jest.fn((apiKey: string, project: any) => {
        cacheStore.set(apiKey, project);
      }),
      shouldRefreshLastUsed: jest.fn().mockResolvedValue(false),
      invalidateProject: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: db },
        { provide: Reflector, useValue: reflector },
        { provide: ProjectsService, useValue: accessSvc },
        { provide: ProjectAuthCacheService, useValue: authCache },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    const req = makeRequest({
      headers: { authorization: `Bearer ${fullKey}` },
      params: { serverId: 'not-a-snowflake' },
    });
    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(
      BadRequestException,
    );
  });

  // ── Happy path — no serverId ──

  it('returns true and attaches project when API key is valid and no serverId', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    let idx = 0;
    const results = [[project]];
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockImplementation(() => Promise.resolve(results[idx++] ?? [])),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    mockReflector = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn(),
    } as any;
    mockAccessService = {
      assertProjectServerRequestAccess: jest.fn(),
    } as any;
    const cacheStore = new Map<string, any>();
    mockProjectAuthCache = {
      get: jest.fn((apiKey: string) => cacheStore.get(apiKey) ?? null),
      set: jest.fn((apiKey: string, project: any) => {
        cacheStore.set(apiKey, project);
      }),
      shouldRefreshLastUsed: jest.fn().mockResolvedValue(false),
      invalidateProject: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
      size: jest.fn().mockResolvedValue(cacheStore.size),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: Reflector, useValue: mockReflector },
        { provide: ProjectsService, useValue: mockAccessService },
        { provide: ProjectAuthCacheService, useValue: mockProjectAuthCache },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    const req = makeRequest({
      headers: { authorization: `Bearer ${fullKey}` },
    });
    const ctx = makeContext(req);
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req['project']).toMatchObject({ id: 'project-1' });
  });

  it('updates apiKeyLastUsedAt when Redis gating allows a refresh', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    let idx = 0;
    const results = [[project]];
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockImplementation(() => Promise.resolve(results[idx++] ?? [])),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    mockReflector = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn(),
    } as any;
    mockAccessService = {
      assertProjectServerRequestAccess: jest.fn(),
    } as any;
    mockProjectAuthCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      shouldRefreshLastUsed: jest.fn().mockResolvedValue(true),
      invalidateProject: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
      size: jest.fn().mockResolvedValue(0),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: Reflector, useValue: mockReflector },
        { provide: ProjectsService, useValue: mockAccessService },
        { provide: ProjectAuthCacheService, useValue: mockProjectAuthCache },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    await guard.canActivate(
      makeContext(
        makeRequest({
          headers: { authorization: `Bearer ${fullKey}` },
        }),
      ),
    );

    expect(mockProjectAuthCache.shouldRefreshLastUsed).toHaveBeenCalledWith(
      'project-1',
    );
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.set).toHaveBeenCalledWith({
      apiKeyLastUsedAt: expect.any(Date),
    });
  });

  it('reuses the cached project on subsequent requests with the same API key', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    let idx = 0;
    const results = [[project]];
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockImplementation(() => Promise.resolve(results[idx++] ?? [])),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    mockReflector = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn(),
    } as any;
    mockAccessService = {
      assertProjectServerRequestAccess: jest.fn(),
    } as any;

    const cacheStore = new Map<string, any>();
    mockProjectAuthCache = {
      get: jest.fn((apiKey: string) => cacheStore.get(apiKey) ?? null),
      set: jest.fn((apiKey: string, cachedProject: any) => {
        cacheStore.set(apiKey, cachedProject);
      }),
      shouldRefreshLastUsed: jest.fn().mockResolvedValue(false),
      invalidateProject: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
      size: jest.fn().mockResolvedValue(cacheStore.size),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: Reflector, useValue: mockReflector },
        { provide: ProjectsService, useValue: mockAccessService },
        { provide: ProjectAuthCacheService, useValue: mockProjectAuthCache },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    const firstRequest = makeRequest({
      headers: { authorization: `Bearer ${fullKey}` },
    });
    const secondRequest = makeRequest({
      headers: { authorization: `Bearer ${fullKey}` },
    });

    await guard.canActivate(makeContext(firstRequest));
    await guard.canActivate(makeContext(secondRequest));

    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockProjectAuthCache.set).toHaveBeenCalledTimes(1);
  });

  it('forwards requiredScope to the cached project-server access assertion', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    let idx = 0;
    const results = [[project]];
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockImplementation(() => Promise.resolve(results[idx++] ?? [])),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    mockReflector = {
      get: jest.fn().mockReturnValue('read_members'),
      getAllAndOverride: jest.fn().mockReturnValue('READ'),
    } as any;
    mockAccessService = {
      assertProjectServerRequestAccess: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockProjectAuthCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      shouldRefreshLastUsed: jest.fn().mockResolvedValue(false),
      invalidateProject: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
      size: jest.fn().mockResolvedValue(0),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: Reflector, useValue: mockReflector },
        { provide: ProjectsService, useValue: mockAccessService },
        { provide: ProjectAuthCacheService, useValue: mockProjectAuthCache },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    await guard.canActivate(
      makeContext({
        headers: { authorization: `Bearer ${fullKey}` },
        params: { serverId: '123456789012345678' },
      }),
    );

    expect(
      mockAccessService.assertProjectServerRequestAccess,
    ).toHaveBeenCalledWith({
      projectId: 'project-1',
      serverId: '123456789012345678',
      operation: 'READ',
      requiredScope: 'read_members',
    });
  });

  // ── Server not found / inactive ──

  it('throws ForbiddenException when server is not found or inactive', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    let idx = 0;
    const results = [[project]];
    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockImplementation(() => Promise.resolve(results[idx++] ?? [])),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    const reflector: any = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn().mockReturnValue('READ'),
    };
    const accessSvc: any = {
      assertProjectServerRequestAccess: jest
        .fn()
        .mockRejectedValue(
          new ForbiddenException('Server not found or inactive'),
        ),
    };
    const cacheStore = new Map<string, any>();
    const authCache: any = {
      get: jest.fn((apiKey: string) => cacheStore.get(apiKey) ?? null),
      set: jest.fn((apiKey: string, project: any) => {
        cacheStore.set(apiKey, project);
      }),
      shouldRefreshLastUsed: jest.fn().mockResolvedValue(false),
      invalidateProject: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: db },
        { provide: Reflector, useValue: reflector },
        { provide: ProjectsService, useValue: accessSvc },
        { provide: ProjectAuthCacheService, useValue: authCache },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    const req = makeRequest({
      headers: { authorization: `Bearer ${fullKey}` },
      params: { serverId: '123456789012345678' }, // valid snowflake
    });
    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
