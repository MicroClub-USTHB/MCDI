import { UnauthorizedException } from '@nestjs/common';
import { ProjectsRepository } from '../../projects/projects.repository';

/**
 * Validate an API key and return the associated project.
 * Throws UnauthorizedException if the key is invalid.
 */
export async function validateApiKeyAndGetProject(
  projectRepository: ProjectsRepository,
  apiKey: string,
) {
  const project = await projectRepository.findByApiKey(apiKey);
  if (!project) {
    throw new UnauthorizedException('Invalid API key');
  }
  return project;
}
