import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
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

      await service.update('proj-1', { name: 'Renamed', scopes: ['scope-a'] });

      expect(mockRepo.replaceScopes).toHaveBeenCalledWith('proj-1', [
        'scope-a',
      ]);
    });
  });
});
