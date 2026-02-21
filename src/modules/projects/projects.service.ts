import { Injectable, NotFoundException } from '@nestjs/common';
import { generateApiKey } from '../../common/utils/api-key.util';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsRepository, ProjectRow } from './projects.repository';

export interface CreateProjectResult {
  /** Returned ONCE — never stored in plaintext, never returned again */
  apiKey: string;
  project: ProjectRow;
}

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async create(dto: CreateProjectDto): Promise<CreateProjectResult> {
    const { fullKey, prefix, hash } = generateApiKey();

    const project = await this.projectsRepository.create({
      name: dto.name,
      description: dto.description,
      apiKeyHash: hash,
      apiKeyPrefix: prefix,
      scopes: dto.scopes ?? [],
    });

    return { apiKey: fullKey, project };
  }



  async findAll(): Promise<ProjectRow[]> {
    return this.projectsRepository.findAll();
  }

  async findOne(id: string): Promise<ProjectRow> {
    const project = await this.projectsRepository.findOne(id);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }


  async update(id: string, dto: UpdateProjectDto): Promise<ProjectRow> {
    // Update name/description if provided
    const project = await this.projectsRepository.update(id, {
      name: dto.name,
      description: dto.description,
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);

    // Replace scopes if provided in the DTO
    if (dto.scopes !== undefined) {
      await this.projectsRepository.replaceScopes(id, dto.scopes);
    }

    return this.findOne(id);
  }


  async regenerateKey(id: string): Promise<{ apiKey: string }> {
    await this.findOne(id); // throws 404 if not found

    const { fullKey, prefix, hash } = generateApiKey();
    await this.projectsRepository.updateKey(id, hash, prefix);

    // Old key is immediately invalid — new prefix+hash stored
    return { apiKey: fullKey };
  }

  async revokeKey(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found
    await this.projectsRepository.setActive(id, false);
  }

  async restoreKey(id: string): Promise<void> {
    await this.findOne(id); // throws 404 if not found
    await this.projectsRepository.setActive(id, true);
  }


  async delete(id: string): Promise<void> {
    const deleted = await this.projectsRepository.delete(id);
    if (!deleted) throw new NotFoundException(`Project ${id} not found`);
  }
}
