import { UnauthorizedException } from '@nestjs/common';
import { validateApiKeyAndGetProject } from './validate-api-key';
import { ProjectsRepository } from '../../projects/projects.repository';

function makeRepo(project: unknown = null): jest.Mocked<Pick<ProjectsRepository, 'findByApiKey'>> {
  return { findByApiKey: jest.fn().mockResolvedValue(project) };
}

const fakeProject = { id: 'proj-1', name: 'Test Project', isInternal: false };

describe('validateApiKeyAndGetProject', () => {
  afterEach(() => jest.clearAllMocks());

  describe('valid API key', () => {
    it('returns the project when the key exists', async () => {
      const repo = makeRepo(fakeProject);
      const result = await validateApiKeyAndGetProject(
        repo as unknown as ProjectsRepository,
        'pk.valid-key',
      );
      expect(result).toBe(fakeProject);
    });

    it('calls findByApiKey with the provided key', async () => {
      const repo = makeRepo(fakeProject);
      await validateApiKeyAndGetProject(
        repo as unknown as ProjectsRepository,
        'pk.my-key',
      );
      expect(repo.findByApiKey).toHaveBeenCalledWith('pk.my-key');
      expect(repo.findByApiKey).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalid API key', () => {
    it('throws UnauthorizedException when project is null', async () => {
      const repo = makeRepo(null);
      await expect(
        validateApiKeyAndGetProject(repo as unknown as ProjectsRepository, 'pk.bad-key'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when project is undefined', async () => {
      const repo = makeRepo(undefined);
      await expect(
        validateApiKeyAndGetProject(repo as unknown as ProjectsRepository, 'pk.bad-key'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws with message "Invalid API key"', async () => {
      const repo = makeRepo(null);
      await expect(
        validateApiKeyAndGetProject(repo as unknown as ProjectsRepository, 'pk.bad-key'),
      ).rejects.toThrow('Invalid API key');
    });
  });
});
