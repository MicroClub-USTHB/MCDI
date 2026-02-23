import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRepository } from '../auth/repositories/project.repository';
import { randomBytes } from 'crypto';

@Injectable()
export class ProjectAdminService {
    constructor(private readonly projectRepository: ProjectRepository) {}

    /**
     * Regenerate API key for a project.
     * Generates a cryptographically secure random key and updates the project.
     */
    async regenerateApiKey(projectId: string) {
        // Generate a new secure API key
        const newApiKey = `mcdi-proj-${randomBytes(32).toString('hex')}`;

        // Update the project with the new key
        const project = await this.projectRepository.regenerateApiKey(
            projectId,
            newApiKey,
        );

        if (!project) {
            throw new NotFoundException(`Project with ID ${projectId} not found`);
        }

        return {
            projectId: project.id,
            apiKey: project.apiKey,
            apiKeyCreatedAt: project.apiKeyCreatedAt,
        };
    }
}
