import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../auth/repositories/project.repository';
import { generateApiKey } from '../../common/utils/api-key.util';

@Injectable()
export class ProjectAdminService {
  constructor(private readonly projectRepository: ProjectRepository) {}

  /**
   * Regenerate API key for a project.
   * Generates a cryptographically secure random key and updates the project.
   * Returns the full key once — it cannot be retrieved again.
   */
  async regenerateApiKey(projectId: string) {
    const { fullKey, prefix, hash } = generateApiKey();

    const project = await this.projectRepository.regenerateApiKey(
      projectId,
      hash,
      prefix,
    );

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return {
      projectId: project.id,
      apiKey: fullKey,
      apiKeyPrefix: project.apiKeyPrefix,
      apiKeyCreatedAt: project.apiKeyCreatedAt,
    };
  }
}
