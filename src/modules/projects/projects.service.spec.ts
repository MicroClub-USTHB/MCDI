import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsRepository } from './projects.repository';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  replaceScopes: jest.fn(),
  updateKey: jest.fn(),
  setActive: jest.fn(),
  delete: jest.fn(),
  regenerateApiKey: jest.fn(),
  updateRedirectUri: jest.fn(),
  // access methods
  findProjectById: jest.fn(),
  findServerById: jest.fn(),
  findAccessMapping: jest.fn(),
  upsertAccessMapping: jest.fn(),
  revokeAccessMapping: jest.fn(),
  insertAuditEntry: jest.fn(),
  isOperationAllowed: jest.fn(),
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
  isActive: true,
  isInternal: false,
  scopes: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ── Suite ─────────────────────────────────────────────────────────────────

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsRepository, useValue: mockRepo },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ────────────────────────────────────────────────────────────

  describe('create', () => {
    it('returns a full API key (prefix.secret) and the project row', async () => {
      const project = fakeProject();
      mockRepo.create.mockResolvedValue(project);

      const result = await service.create({
        name: 'Test',
        description: 'desc',
        scopes: [],
      });

      expect(result.project).toEqual(project);
      // Key format: pk_<8hex>.<64hex>
      expect(result.apiKey).toMatch(/^pk_[0-9a-f]{8}\.[0-9a-f]{64}$/);
    });

    it('stores the hash, not the plaintext secret', async () => {
      const project = fakeProject();
      mockRepo.create.mockResolvedValue(project);

      await service.create({ name: 'P', description: '', scopes: [] });

      const arg = mockRepo.create.mock.calls[0][0];
      expect(arg).toHaveProperty('apiKeyHash');
      expect(arg).toHaveProperty('apiKeyPrefix');
      expect(arg).not.toHaveProperty('fullKey');
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

  // ── regenerateKey ─────────────────────────────────────────────────────

  describe('regenerateKey', () => {
    it('returns a new full key and updates only prefix+hash', async () => {
      mockRepo.findOne.mockResolvedValue(fakeProject());
      mockRepo.updateKey.mockResolvedValue(undefined);

      const result = await service.regenerateKey('proj-1');

      expect(result.apiKey).toMatch(/^pk_[0-9a-f]{8}\.[0-9a-f]{64}$/);
      expect(mockRepo.updateKey).toHaveBeenCalledWith(
        'proj-1',
        expect.stringMatching(/^[0-9a-f]{64}$/), // hash
        expect.stringMatching(/^pk_/), // prefix
      );
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.regenerateKey('missing')).rejects.toThrow(
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
    });
  });

  describe('restoreKey', () => {
    it('calls setActive(true)', async () => {
      mockRepo.findOne.mockResolvedValue(fakeProject());
      mockRepo.setActive.mockResolvedValue(undefined);

      await service.restoreKey('proj-1');
      expect(mockRepo.setActive).toHaveBeenCalledWith('proj-1', true);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('resolves when project is deleted', async () => {
      mockRepo.delete.mockResolvedValue(fakeProject());
      await expect(service.delete('proj-1')).resolves.toBeUndefined();
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

    it('updates name/description without touching scopes when dto.scopes is undefined', async () => {
      const updated = fakeProject();
      mockRepo.update.mockResolvedValue(updated);
      mockRepo.findOne.mockResolvedValue(updated);

      const result = await service.update('proj-1', { name: 'Renamed' });

      expect(result).toEqual(updated);
      expect(mockRepo.replaceScopes).not.toHaveBeenCalled();
    });

    it('replaces scopes when dto.scopes is provided', async () => {
      const updated = fakeProject();
      mockRepo.update.mockResolvedValue(updated);
      mockRepo.findOne.mockResolvedValue(updated);
      mockRepo.replaceScopes.mockResolvedValue(undefined);

      await service.update('proj-1', { name: 'Renamed', scopes: ['read_members' as any] });

      expect(mockRepo.replaceScopes).toHaveBeenCalledWith('proj-1', [
        'read_members',
      ]);
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
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.regenerateApiKey.mockResolvedValue(null);
      await expect(service.regenerateApiKeyAdmin('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateRedirectUri ───────────────────────────────────────────────

  describe('updateRedirectUri', () => {
    it('returns projectId and redirectUri on success', async () => {
      const project = { ...fakeProject(), redirectUri: 'https://example.com/cb' };
      mockRepo.updateRedirectUri.mockResolvedValue(project);

      const result = await service.updateRedirectUri('proj-1', { redirectUri: 'https://example.com/cb' });
      expect(result).toEqual({ projectId: 'proj-1', redirectUri: 'https://example.com/cb' });
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
      expect(mockRepo.insertAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REVOKE' }),
      );
    });
  });

  // ── canProjectAccessOperation ──────────────────────────────────────

  describe('canProjectAccessOperation', () => {
    it('returns true when operation is allowed', async () => {
      mockRepo.isOperationAllowed.mockResolvedValue(true);

      const result = await service.canProjectAccessOperation(
        'proj-1',
        'guild-1',
        'READ',
      );
      expect(result).toBe(true);
    });

    it('returns false when operation is not allowed', async () => {
      mockRepo.isOperationAllowed.mockResolvedValue(false);

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
      mockRepo.isOperationAllowed.mockResolvedValue(true);

      await expect(
        service.assertProjectAccessOperation('proj-1', 'guild-1', 'READ'),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when operation is not allowed', async () => {
      mockRepo.isOperationAllowed.mockResolvedValue(false);

      await expect(
        service.assertProjectAccessOperation(
          'proj-1',
          'guild-1',
          'SEND_MESSAGES',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── list methods ───────────────────────────────────────────────────

  describe('listServersByProject', () => {
    it('delegates to repository', async () => {
      mockRepo.listServersByProject.mockResolvedValue([{ id: 'guild-1' }]);

      const result = await service.listServersByProject('proj-1');
      expect(result).toEqual([{ id: 'guild-1' }]);
      expect(mockRepo.listServersByProject).toHaveBeenCalledWith('proj-1');
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
      expect(mockRepo.listAudit).toHaveBeenCalledWith(100);
    });

    it('clamps limit to maximum 500', async () => {
      mockRepo.listAudit.mockResolvedValue([]);

      await service.listAudit(9999);
      expect(mockRepo.listAudit).toHaveBeenCalledWith(500);
    });

    it('clamps limit to minimum 1', async () => {
      mockRepo.listAudit.mockResolvedValue([]);

      await service.listAudit(0);
      expect(mockRepo.listAudit).toHaveBeenCalledWith(1);
    });
  });
});
