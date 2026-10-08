import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PermissionCacheService } from '../permissions/permission-cache.service';
import { AdminAccessRepository } from './admin-access.repository';
import { AdminAccessService } from './admin-access.service';

describe('AdminAccessService', () => {
  let service: AdminAccessService;
  const repo = {
    findMainServerId: jest.fn(),
    findMemberRoleIdsInServer: jest.fn(),
    findGrantsForRoles: jest.fn(),
    findMemberOverrides: jest.fn(),
  };
  const cache = {
    getAdminAccess: jest.fn(),
    setAdminAccess: jest.fn(),
    invalidateMember: jest.fn(),
  };
  const roots: Record<string, string> = {
    'discord.executiveRoleId': 'root-exec',
    'discord.devLeadRoleId': 'root-dev',
    'discord.itLeadRoleId': '',
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    cache.getAdminAccess.mockResolvedValue(null);
    repo.findGrantsForRoles.mockResolvedValue([]);
    repo.findMemberOverrides.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        AdminAccessService,
        { provide: AdminAccessRepository, useValue: repo },
        { provide: PermissionCacheService, useValue: cache },
        { provide: ConfigService, useValue: { get: (k: string) => roots[k] } },
      ],
    }).compile();
    service = module.get(AdminAccessService);
  });

  it('returns the cached value without touching the database', async () => {
    const cached = { root: true, access: {} as never };
    cache.getAdminAccess.mockResolvedValue(cached);

    await expect(service.getEffectiveAccess('m1')).resolves.toBe(cached);
    expect(repo.findMainServerId).not.toHaveBeenCalled();
  });

  it('gives nobody any access, root included, when no main server exists', async () => {
    repo.findMainServerId.mockResolvedValue(null);

    const result = await service.getEffectiveAccess('m1');

    expect(result.root).toBe(false);
    expect(result.access.members.level).toBe('none');
    expect(cache.setAdminAccess).not.toHaveBeenCalled();
  });

  it('treats a holder of a root role as root with manage everywhere, and skips loading grants', async () => {
    repo.findMainServerId.mockResolvedValue('main');
    repo.findMemberRoleIdsInServer.mockResolvedValue(['other', 'root-dev']);

    const result = await service.getEffectiveAccess('m1');

    expect(result.root).toBe(true);
    expect(result.access.messages).toEqual({
      level: 'manage',
      source: { type: 'root' },
    });
    expect(repo.findGrantsForRoles).not.toHaveBeenCalled();
    expect(cache.setAdminAccess).toHaveBeenCalledWith('m1', 'main', result);
  });

  it('resolves a non-root member from role grants and overrides, then caches it', async () => {
    repo.findMainServerId.mockResolvedValue('main');
    repo.findMemberRoleIdsInServer.mockResolvedValue(['role-hr']);
    repo.findGrantsForRoles.mockResolvedValue([
      { roleId: 'role-hr', resource: 'members', level: 'read' },
      { roleId: 'role-hr', resource: 'audit', level: 'read' },
    ]);
    repo.findMemberOverrides.mockResolvedValue([
      { resource: 'audit', level: 'none' },
    ]);

    const result = await service.getEffectiveAccess('m1');

    expect(repo.findGrantsForRoles).toHaveBeenCalledWith(['role-hr']);
    expect(result.root).toBe(false);
    expect(result.access.members.level).toBe('read');
    expect(result.access.audit).toEqual({
      level: 'none',
      source: { type: 'override' },
    });
    expect(cache.setAdminAccess).toHaveBeenCalledWith('m1', 'main', result);
  });

  it('knows which roles are root, ignoring unset ones', () => {
    expect(service.isRootRole('root-exec')).toBe(true);
    expect(service.isRootRole('root-dev')).toBe(true);
    expect(service.isRootRole('')).toBe(false);
    expect(service.isRootRole('role-hr')).toBe(false);
  });

  it('invalidates one member through the cache', async () => {
    await service.invalidateMember('m1');
    expect(cache.invalidateMember).toHaveBeenCalledWith('m1');
  });
});
