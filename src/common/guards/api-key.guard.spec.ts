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
import { ProjectsAccessService } from '../../modules/projects/projects-access.service';
import * as scopeUtil from '../utils/scope.util';

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
  let mockAccessService: jest.Mocked<ProjectsAccessService>;

  const setupGuard = async (projectRows: any[]) => {
    // DB returns: [projects query, update set chain, scopes query, servers query]
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
        { provide: ProjectsAccessService, useValue: mockAccessService },
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
        { provide: ProjectsAccessService, useValue: accessSvc },
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
        { provide: ProjectsAccessService, useValue: mockAccessService },
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
        { provide: ProjectsAccessService, useValue: accessSvc },
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

  it('does not block request when last-used timestamp update fails', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([{ id: '123456789012345678', isActive: true }]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    // Fail only the fire-and-forget update path.
    db.where
      .mockReturnValueOnce(db) // projects lookup
      .mockRejectedValueOnce(new Error('write failed')) // update where
      .mockReturnValueOnce(db); // servers lookup

    const reflector: any = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn().mockReturnValue('READ'),
    };
    const accessSvc: any = {
      assertProjectAccessOperation: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: db },
        { provide: Reflector, useValue: reflector },
        { provide: ProjectsAccessService, useValue: accessSvc },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    const req = makeRequest({
      headers: { authorization: `Bearer ${fullKey}` },
      params: { serverId: '123456789012345678' },
    });

    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(accessSvc.assertProjectAccessOperation).toHaveBeenCalled();
  });

  it('prefers params.serverId over query/body/header server id values', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest
        .fn()
        .mockResolvedValueOnce([project])
        .mockResolvedValueOnce([{ id: '123456789012345678', isActive: true }]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    const reflector: any = {
      get: jest.fn().mockReturnValue(null),
      getAllAndOverride: jest.fn().mockReturnValue('READ'),
    };
    const accessSvc: any = {
      assertProjectAccessOperation: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: db },
        { provide: Reflector, useValue: reflector },
        { provide: ProjectsAccessService, useValue: accessSvc },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    await guard.canActivate(
      makeContext(
        makeRequest({
          headers: {
            authorization: `Bearer ${fullKey}`,
            'x-server-id': '123456789012345679',
          },
          params: { serverId: '123456789012345678' },
          query: { serverId: '123456789012345677' } as any,
          body: { serverId: '123456789012345676' },
        }),
      ),
    );

    expect(accessSvc.assertProjectAccessOperation).toHaveBeenCalledWith(
      'project-1',
      '123456789012345678',
      'READ',
    );
  });

  it('checks scope before server access checks', async () => {
    const { generateApiKey } = require('../utils/api-key.util');
    const { fullKey, prefix, hash } = generateApiKey();
    const project = {
      ...ACTIVE_PROJECT,
      apiKeyPrefix: prefix,
      apiKeyHash: hash,
    };

    const db = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([project]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    const reflector: any = {
      get: jest.fn().mockReturnValue('read_members'),
      getAllAndOverride: jest.fn().mockReturnValue('READ'),
    };
    const accessSvc: any = {
      assertProjectAccessOperation: jest.fn().mockResolvedValue(undefined),
    };

    const validateScopeSpy = jest
      .spyOn(scopeUtil, 'validateScope')
      .mockRejectedValue(new ForbiddenException('missing scope'));

    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: DRIZZLE, useValue: db },
        { provide: Reflector, useValue: reflector },
        { provide: ProjectsAccessService, useValue: accessSvc },
      ],
    }).compile();
    guard = module.get(ApiKeyGuard);

    const req = makeRequest({
      headers: { authorization: `Bearer ${fullKey}` },
      params: { serverId: '123456789012345678' },
    });

    await expect(guard.canActivate(makeContext(req))).rejects.toThrow(
      ForbiddenException,
    );
    expect(validateScopeSpy).toHaveBeenCalledWith(
      expect.any(Object),
      'project-1',
      'read_members',
    );
    expect(accessSvc.assertProjectAccessOperation).not.toHaveBeenCalled();

    validateScopeSpy.mockRestore();
  });
});
