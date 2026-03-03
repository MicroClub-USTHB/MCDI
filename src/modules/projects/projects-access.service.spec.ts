import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsAccessService } from './projects-access.service';
import { ProjectsAccessRepository } from './projects-access.repository';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockRepo = {
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

// ── Suite ──────────────────────────────────────────────────────────────────

describe('ProjectsAccessService', () => {
  let service: ProjectsAccessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsAccessService,
        { provide: ProjectsAccessRepository, useValue: mockRepo },
      ],
    }).compile();
    service = module.get(ProjectsAccessService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── grantAccess ─────────────────────────────────────────────────────────

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
      mockRepo.findAccessMapping.mockResolvedValue(null); // no prior mapping → GRANT
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
      mockRepo.findAccessMapping.mockResolvedValue(prior); // existing → UPDATE
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
      expect(ops.READ).toBe(false); // overridden
      expect(ops).toHaveProperty('SEND_MESSAGES'); // default filled in
    });
  });

  // ── revokeAccess ────────────────────────────────────────────────────────

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

  // ── canProjectAccessOperation ───────────────────────────────────────────

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

  // ── assertProjectAccessOperation ────────────────────────────────────────

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

  // ── list methods ─────────────────────────────────────────────────────────

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
