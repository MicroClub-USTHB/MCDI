import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../auth/repositories/project.repository';
import { generateApiKey } from '../../common/utils/api-key.util';
import { UpdateRedirectUriDto } from './dto/update-redirect-uri.dto';

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

  /**
   * Update the allowed redirect URI(s) for a project.
   * Accepts a single URI or a comma-separated list of URIs.
   */
  async updateRedirectUri(projectId: string, dto: UpdateRedirectUriDto) {
    const project = await this.projectRepository.updateRedirectUri(
      projectId,
      dto.redirectUri,
    );

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return {
      projectId: project.id,
      redirectUri: project.redirectUri,
    };
  }
}
