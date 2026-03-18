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

  const setupGuard = async (projectRows: any[]) => {
    // DB returns: [projects query, update set chain, servers query]
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
      assertProjectAccessOperation: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: Reflector, useValue: mockReflector },
        { provide: ProjectsService, useValue: mockAccessService },
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
    // First DB select returns project, second server lookup hits bad format check first
    let idx = 0;
    const results = [[project], []];
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
    const accessSvc: any = { assertProjectAccessOperation: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: db },
        { provide: Reflector, useValue: reflector },
        { provide: ProjectsService, useValue: accessSvc },
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
    mockAccessService = { assertProjectAccessOperation: jest.fn() } as any;

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: Reflector, useValue: mockReflector },
        { provide: ProjectsService, useValue: mockAccessService },
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
    const results = [[project], []]; // second call returns empty (server not found)
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
    const accessSvc: any = { assertProjectAccessOperation: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: db },
        { provide: Reflector, useValue: reflector },
        { provide: ProjectsService, useValue: accessSvc },
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
