import { UnauthorizedException } from '@nestjs/common';
import { ProjectRepository } from '../../projects/project.repository';

/**
 * Validate an API key and return the associated project.
 * Throws UnauthorizedException if the key is invalid.
 */
export async function validateApiKeyAndGetProject(
  projectRepository: ProjectRepository,
  apiKey: string,
) {
  const project = await projectRepository.findByApiKey(apiKey);
  if (!project) {
    throw new UnauthorizedException('Invalid API key');
  }
  return project;
}
