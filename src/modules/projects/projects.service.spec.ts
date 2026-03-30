import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';
import { ProjectAuthCacheService } from './project-auth-cache.service';
import { ProjectAccessCacheService } from './project-access-cache.service';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  updateKey: jest.fn(),
  setActive: jest.fn(),
  delete: jest.fn(),
  regenerateApiKey: jest.fn(),
  updateRedirectUri: jest.fn(),
  // access methods
  findProjectById: jest.fn(),
  findServerById: jest.fn(),
  findMainServers: jest.fn(),
  findAccessMapping: jest.fn(),
  upsertAccessMapping: jest.fn(),
  revokeAccessMapping: jest.fn(),
  insertAuditEntry: jest.fn(),
  isOperationAllowed: jest.fn(),
  isScopeAllowed: jest.fn(),
  findProjectServerAccessState: jest.fn(),
  listServersByProject: jest.fn(),
  listProjectsByServer: jest.fn(),
  listAccessMatrix: jest.fn(),
  listAudit: jest.fn(),
};

const fakeProject = (overrides = {}) => ({
  id: 'proj-1',
  name: 'Test Project',
  description: 'desc',
  apiKeyPrefix: 'pk_aabbccdd',
  apiKeyHash: 'somehash',
  apiKeyCreatedAt: new Date(),
  apiKeyLastUsedAt: null,
  isActive: true,
  isInternal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ── Suite ─────────────────────────────────────────────────────────────────

describe('ProjectsService', () => {
  let service: ProjectsService;
  const mockProjectAuthCache = {
    invalidateProject: jest.fn(),
  };
  const mockProjectAccessCache = {
    get: jest.fn(),
    set: jest.fn(),
    invalidateProject: jest.fn(),
    invalidateServer: jest.fn(),
  };

  beforeEach(async () => {
    mockProjectAuthCache.invalidateProject.mockResolvedValue(undefined);
    mockProjectAccessCache.get.mockResolvedValue(null);
    mockProjectAccessCache.set.mockResolvedValue(undefined);
    mockProjectAccessCache.invalidateProject.mockResolvedValue(undefined);
    mockProjectAccessCache.invalidateServer.mockResolvedValue(undefined);
    mockRepo.findProjectServerAccessState.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsRepository, useValue: mockRepo },
        { provide: ProjectAuthCacheService, useValue: mockProjectAuthCache },
        {
          provide: ProjectAccessCacheService,
          useValue: mockProjectAccessCache,
        },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────

  describe('create', () => {
    it('returns a full API key (prefix.secret) and the project row', async () => {
      const project = fakeProject();
      mockRepo.findMainServers.mockResolvedValue([{ id: 'guild-1' }]);
      mockRepo.findServerById.mockResolvedValue({ id: 'guild-1' });
      mockRepo.create.mockResolvedValue(project);

      const result = await service.create({
        name: 'Test',
        description: 'desc',
      });

      expect(result.project).toEqual(project);
      // Key format: pk_<8hex>.<64hex>
      expect(result.apiKey).toMatch(/^pk_[0-9a-f]{8}\.[0-9a-f]{64}$/);
    });

    it('stores the hash, not the plaintext secret', async () => {
      const project = fakeProject();
      mockRepo.findMainServers.mockResolvedValue([{ id: 'guild-1' }]);
      mockRepo.findServerById.mockResolvedValue({ id: 'guild-1' });
      mockRepo.create.mockResolvedValue(project);

      await service.create({ name: 'P', description: '' });

      const arg = mockRepo.create.mock.calls[0][0];
      expect(arg).toHaveProperty('apiKeyHash');
      expect(arg).toHaveProperty('apiKeyPrefix');
      expect(arg).not.toHaveProperty('fullKey');
    });

    it('throws ConflictException when no main server exists and serverAccess is omitted', async () => {
      mockRepo.findMainServers.mockResolvedValue([]);

      await expect(service.create({ name: 'Test' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when serverAccess contains unknown server ids', async () => {
      mockRepo.findServerById
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'guild-2' });

      await expect(
        service.create({
          name: 'Test',
          serverAccess: [{ serverId: 'guild-1' }, { serverId: 'guild-2' }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the project when found', async () => {
      const project = fakeProject();
      mockRepo.findOne.mockResolvedValue(project);
      expect(await service.findOne('proj-1')).toEqual(project);
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getApiKeyInfo ─────────────────────────────────────────────────────

  describe('getApiKeyInfo', () => {
    it('returns API key metadata for an existing project', async () => {
      const project = fakeProject();
      mockRepo.findOne.mockResolvedValue(project);

      const result = await service.getApiKeyInfo('proj-1');

      expect(result).toEqual({
        projectId: project.id,
        projectName: project.name,
        apiKeyPrefix: project.apiKeyPrefix,
        apiKeyCreatedAt: project.apiKeyCreatedAt,
        apiKeyLastUsedAt: project.apiKeyLastUsedAt,
        isActive: project.isActive,
      });
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getApiKeyInfo('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── revokeKey / restoreKey ────────────────────────────────────────────

  describe('revokeKey', () => {
    it('calls setActive(false)', async () => {
      mockRepo.findOne.mockResolvedValue(fakeProject());
      mockRepo.setActive.mockResolvedValue(undefined);

      await service.revokeKey('proj-1');
      expect(mockRepo.setActive).toHaveBeenCalledWith('proj-1', false);
      expect(mockProjectAuthCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(mockProjectAccessCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
    });
  });

  describe('restoreKey', () => {
    it('calls setActive(true)', async () => {
      mockRepo.findOne.mockResolvedValue(fakeProject());
      mockRepo.setActive.mockResolvedValue(undefined);

      await service.restoreKey('proj-1');
      expect(mockRepo.setActive).toHaveBeenCalledWith('proj-1', true);
      expect(mockProjectAuthCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(mockProjectAccessCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
    });
  });

  // ── delete ────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('resolves when project is deleted', async () => {
      mockRepo.delete.mockResolvedValue(true);
      await expect(service.delete('proj-1')).resolves.toBeUndefined();
      expect(mockProjectAuthCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(mockProjectAccessCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.delete.mockResolvedValue(null);
      await expect(service.delete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all projects from repository', async () => {
      const projects = [fakeProject(), fakeProject()];
      mockRepo.findAll.mockResolvedValue(projects);

      const result = await service.findAll();
      expect(result).toEqual(projects);
      expect(mockRepo.findAll).toHaveBeenCalled();
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.update.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates name/description', async () => {
      const updated = fakeProject();
      mockRepo.update.mockResolvedValue(updated);
      mockRepo.findOne.mockResolvedValue(updated);

      const result = await service.update('proj-1', { name: 'Renamed' });

      expect(result).toEqual(updated);
      expect(mockProjectAuthCache.invalidateProject).toHaveBeenCalledWith(
        updated.id,
      );
      expect(mockProjectAccessCache.invalidateProject).toHaveBeenCalledWith(
        updated.id,
      );
    });
  });

  // ── regenerateApiKeyAdmin ──────────────────────────────────────

  describe('regenerateApiKeyAdmin', () => {
    it('returns new full key with project metadata on success', async () => {
      const project = { ...fakeProject(), apiKeyCreatedAt: new Date() };
      mockRepo.regenerateApiKey.mockResolvedValue(project);

      const result = await service.regenerateApiKeyAdmin('proj-1');
      expect(result.projectId).toBe('proj-1');
      expect(typeof result.apiKey).toBe('string');
      expect(result.apiKey).toContain('.');
      expect(mockRepo.regenerateApiKey).toHaveBeenCalledWith(
        'proj-1',
        expect.any(String),
        expect.any(String),
      );
      expect(mockProjectAuthCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(mockProjectAccessCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.regenerateApiKey.mockResolvedValue(null);
      await expect(service.regenerateApiKeyAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateRedirectUri ───────────────────────────────────────────────

  describe('updateRedirectUri', () => {
    it('returns projectId and redirectUri on success', async () => {
      const project = {
        ...fakeProject(),
        redirectUri: 'https://example.com/cb',
      };
      mockRepo.updateRedirectUri.mockResolvedValue(project);

      const result = await service.updateRedirectUri('proj-1', {
        redirectUri: 'https://example.com/cb',
      });
      expect(result).toEqual({
        projectId: 'proj-1',
        redirectUri: 'https://example.com/cb',
      });
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.updateRedirectUri.mockResolvedValue(null);
      await expect(
        service.updateRedirectUri('missing', { redirectUri: 'https://x.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── grantAccess ────────────────────────────────────────────────

  describe('grantAccess', () => {
    const baseParams = {
      projectId: 'proj-1',
      serverId: 'guild-1',
      changedBy: 'admin-1',
    };

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.findProjectById.mockResolvedValue(null);

      await expect(service.grantAccess(baseParams)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when server does not exist', async () => {
      mockRepo.findProjectById.mockResolvedValue({ id: 'proj-1' });
      mockRepo.findServerById.mockResolvedValue(null);

      await expect(service.grantAccess(baseParams)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns saved mapping with GRANT action when no prior mapping exists', async () => {
      const savedMapping = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        operations: {},
      };
      mockRepo.findProjectById.mockResolvedValue({ id: 'proj-1' });
      mockRepo.findServerById.mockResolvedValue({ id: 'guild-1' });
      mockRepo.findAccessMapping.mockResolvedValue(null);
      mockRepo.upsertAccessMapping.mockResolvedValue(savedMapping);
      mockRepo.insertAuditEntry.mockResolvedValue(undefined);

      const result = await service.grantAccess(baseParams);

      expect(result).toEqual(savedMapping);
      expect(mockProjectAccessCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(mockProjectAccessCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
      expect(mockRepo.insertAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GRANT' }),
      );
    });

    it('uses UPDATE audit action when a prior mapping already exists', async () => {
      const prior = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        operations: { READ: true },
      };
      const saved = { ...prior };
      mockRepo.findProjectById.mockResolvedValue({ id: 'proj-1' });
      mockRepo.findServerById.mockResolvedValue({ id: 'guild-1' });
      mockRepo.findAccessMapping.mockResolvedValue(prior);
      mockRepo.upsertAccessMapping.mockResolvedValue(saved);
      mockRepo.insertAuditEntry.mockResolvedValue(undefined);

      await service.grantAccess(baseParams);

      expect(mockRepo.insertAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'UPDATE' }),
      );
    });

    it('uses default operations when none are provided', async () => {
      mockRepo.findProjectById.mockResolvedValue({ id: 'proj-1' });
      mockRepo.findServerById.mockResolvedValue({ id: 'guild-1' });
      mockRepo.findAccessMapping.mockResolvedValue(null);
      mockRepo.upsertAccessMapping.mockResolvedValue({});
      mockRepo.insertAuditEntry.mockResolvedValue(undefined);

      await service.grantAccess(baseParams);

      const upsertCall = mockRepo.upsertAccessMapping.mock.calls[0][2];
      expect(upsertCall).toHaveProperty('READ');
      expect(upsertCall).toHaveProperty('SEND_MESSAGES');
      expect(upsertCall).toHaveProperty('MANAGE_WEBHOOKS');
    });

    it('merges partial operations with defaults', async () => {
      mockRepo.findProjectById.mockResolvedValue({ id: 'proj-1' });
      mockRepo.findServerById.mockResolvedValue({ id: 'guild-1' });
      mockRepo.findAccessMapping.mockResolvedValue(null);
      mockRepo.upsertAccessMapping.mockResolvedValue({});
      mockRepo.insertAuditEntry.mockResolvedValue(undefined);

      await service.grantAccess({ ...baseParams, operations: { READ: false } });

      const ops = mockRepo.upsertAccessMapping.mock.calls[0][2];
      expect(ops.READ).toBe(false);
      expect(ops).toHaveProperty('SEND_MESSAGES');
    });
  });

  // ── revokeAccess ──────────────────────────────────────────────

  describe('revokeAccess', () => {
    const baseParams = {
      projectId: 'proj-1',
      serverId: 'guild-1',
      changedBy: 'admin-1',
    };

    it('throws NotFoundException when no access mapping exists', async () => {
      mockRepo.findAccessMapping.mockResolvedValue(null);

      await expect(service.revokeAccess(baseParams)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('revokes access and inserts REVOKE audit entry', async () => {
      const existing = {
        projectId: 'proj-1',
        serverId: 'guild-1',
        operations: { READ: true },
      };
      mockRepo.findAccessMapping.mockResolvedValue(existing);
      mockRepo.revokeAccessMapping.mockResolvedValue(undefined);
      mockRepo.insertAuditEntry.mockResolvedValue(undefined);

      const result = await service.revokeAccess(baseParams);

      expect(result).toMatchObject({
        revoked: true,
        projectId: 'proj-1',
        serverId: 'guild-1',
      });
      expect(mockRepo.revokeAccessMapping).toHaveBeenCalledWith(
        'proj-1',
        'guild-1',
      );
      expect(mockProjectAccessCache.invalidateProject).toHaveBeenCalledWith(
        'proj-1',
      );
      expect(mockProjectAccessCache.invalidateServer).toHaveBeenCalledWith(
        'guild-1',
      );
      expect(mockRepo.insertAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REVOKE' }),
      );
    });
  });

  // ── canProjectAccessOperation ──────────────────────────────────────

  describe('canProjectAccessOperation', () => {
    it('returns true when operation is allowed', async () => {
      mockProjectAccessCache.get.mockResolvedValue({
        projectId: 'proj-1',
        serverId: 'guild-1',
        operations: {
          READ: true,
          SEND_MESSAGES: false,
          MANAGE_WEBHOOKS: false,
        },
        scopes: [],
      });

      const result = await service.canProjectAccessOperation(
        'proj-1',
        'guild-1',
        'READ',
      );
      expect(result).toBe(true);
      expect(mockRepo.findProjectServerAccessState).not.toHaveBeenCalled();
    });

    it('returns false when operation is not allowed', async () => {
      mockProjectAccessCache.get.mockResolvedValue({
        projectId: 'proj-1',
        serverId: 'guild-1',
        operations: {
          READ: true,
          SEND_MESSAGES: false,
          MANAGE_WEBHOOKS: false,
        },
        scopes: [],
      });

      const result = await service.canProjectAccessOperation(
        'proj-1',
        'guild-1',
        'MANAGE_WEBHOOKS',
      );
      expect(result).toBe(false);
    });
  });

  // ── assertProjectAccessOperation ──────────────────────────────────

  describe('assertProjectAccessOperation', () => {
    it('resolves without error when operation is allowed', async () => {
      mockProjectAccessCache.get.mockResolvedValue({
        projectId: 'proj-1',
        serverId: 'guild-1',
        operations: {
          READ: true,
          SEND_MESSAGES: false,
          MANAGE_WEBHOOKS: false,
        },
        scopes: ['read_members'],
      });

      await expect(
        service.assertProjectAccessOperation('proj-1', 'guild-1', 'READ'),
      ).resolves.toBeUndefined();
    });

    it('hydrates the access cache after a database lookup', async () => {
      mockRepo.findProjectServerAccessState.mockResolvedValue({
        serverId: 'guild-1',
        serverIsActive: true,
        operations: {
          READ: true,
          SEND_MESSAGES: true,
          MANAGE_WEBHOOKS: false,
        },
        scopes: ['read_members'],
      });

      await expect(
        service.assertProjectServerRequestAccess({
          projectId: 'proj-1',
          serverId: 'guild-1',
          operation: 'READ',
          requiredScope: 'read_members',
        }),
      ).resolves.toBeUndefined();

      expect(mockProjectAccessCache.set).toHaveBeenCalledWith({
        projectId: 'proj-1',
        serverId: 'guild-1',
        operations: {
          READ: true,
          SEND_MESSAGES: true,
          MANAGE_WEBHOOKS: false,
        },
        scopes: ['read_members'],
      });
    });

    it('throws ForbiddenException when operation is not allowed', async () => {
      mockRepo.findProjectServerAccessState.mockResolvedValue({
        serverId: 'guild-1',
        serverIsActive: true,
        operations: {
          READ: true,
          SEND_MESSAGES: false,
          MANAGE_WEBHOOKS: false,
        },
        scopes: ['read_members'],
      });

      await expect(
        service.assertProjectAccessOperation(
          'proj-1',
          'guild-1',
          'SEND_MESSAGES',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when required scope is missing', async () => {
      mockRepo.findProjectServerAccessState.mockResolvedValue({
        serverId: 'guild-1',
        serverIsActive: true,
        operations: {
          READ: true,
          SEND_MESSAGES: true,
          MANAGE_WEBHOOKS: false,
        },
        scopes: ['read_members'],
      });

      await expect(
        service.assertProjectServerRequestAccess({
          projectId: 'proj-1',
          serverId: 'guild-1',
          operation: 'READ',
          requiredScope: 'manage_bots',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the target server is inactive', async () => {
      mockRepo.findProjectServerAccessState.mockResolvedValue({
        serverId: 'guild-1',
        serverIsActive: false,
        operations: null,
        scopes: null,
      });

      await expect(
        service.assertProjectServerRequestAccess({
          projectId: 'proj-1',
          serverId: 'guild-1',
          operation: 'READ',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── list methods ───────────────────────────────────────────────────

  describe('listServersByProject', () => {
    it('delegates to repository', async () => {
      mockRepo.listServersByProject.mockResolvedValue([{ id: 'guild-1' }]);

      const result = await service.listServersByProject('proj-1');
      expect(result).toEqual([{ id: 'guild-1' }]);
      expect(mockRepo.listServersByProject).toHaveBeenCalledWith(
        'proj-1',
        undefined,
      );
    });
  });

  describe('listProjectsByServer', () => {
    it('delegates to repository', async () => {
      mockRepo.listProjectsByServer.mockResolvedValue([{ id: 'proj-1' }]);

      const result = await service.listProjectsByServer('guild-1');
      expect(result).toEqual([{ id: 'proj-1' }]);
    });
  });

  describe('listAccessMatrix', () => {
    it('delegates to repository', async () => {
      mockRepo.listAccessMatrix.mockResolvedValue([]);

      const result = await service.listAccessMatrix();
      expect(result).toEqual([]);
      expect(mockRepo.listAccessMatrix).toHaveBeenCalled();
    });
  });

  describe('listAudit', () => {
    it('delegates to repository with default limit', async () => {
      mockRepo.listAudit.mockResolvedValue([]);

      await service.listAudit();
      expect(mockRepo.listAudit).toHaveBeenCalledWith({ limit: 100 });
    });

    it('clamps limit to maximum 500', async () => {
      mockRepo.listAudit.mockResolvedValue([]);

      await service.listAudit({ limit: 9999 });
      expect(mockRepo.listAudit).toHaveBeenCalledWith({ limit: 500 });
    });

    it('clamps limit to minimum 1', async () => {
      mockRepo.listAudit.mockResolvedValue([]);

      await service.listAudit({ limit: 0 });
      expect(mockRepo.listAudit).toHaveBeenCalledWith({ limit: 1 });
    });
  });
});
