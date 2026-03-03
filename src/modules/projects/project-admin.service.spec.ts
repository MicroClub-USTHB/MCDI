import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectAdminService } from './project-admin.service';
import { ProjectRepository } from '../auth/repositories/project.repository';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockProjectRepo = {
  regenerateApiKey: jest.fn(),
};

// ── Suite ──────────────────────────────────────────────────────────────────

describe('ProjectAdminService', () => {
  let service: ProjectAdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAdminService,
        { provide: ProjectRepository, useValue: mockProjectRepo },
      ],
    }).compile();
    service = module.get(ProjectAdminService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── regenerateApiKey ────────────────────────────────────────────────────

  describe('regenerateApiKey', () => {
    it('throws NotFoundException when project is not found', async () => {
      mockProjectRepo.regenerateApiKey.mockResolvedValue(null);

      await expect(service.regenerateApiKey('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the new full API key with project metadata on success', async () => {
      const fakeProject = {
        id: 'proj-1',
        apiKeyPrefix: 'pk_abc12345',
        apiKeyCreatedAt: new Date(),
      };
      mockProjectRepo.regenerateApiKey.mockResolvedValue(fakeProject);

      const result = await service.regenerateApiKey('proj-1');

      expect(result.projectId).toBe('proj-1');
      expect(result.apiKey).toMatch(/^pk_[0-9a-f]{8}\.[0-9a-f]{64}$/);
      expect(result.apiKeyPrefix).toBe('pk_abc12345');
      expect(mockProjectRepo.regenerateApiKey).toHaveBeenCalledWith(
        'proj-1',
        expect.stringMatching(/^[0-9a-f]{64}$/), // hash
        expect.stringMatching(/^pk_/), // prefix
      );
    });
  });
});
