import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectServerOperations } from '../../database/entities/project-server.entity';
import { RedisService } from '../../common/redis/redis.service';

const INDEX_TTL_BUFFER_MS = 60_000;

interface CachedAccessPayload {
  projectId: string;
  serverId: string;
  operations: ProjectServerOperations;
  scopes: string[];
}

export interface ProjectAccessContext {
  projectId: string;
  serverId: string;
  operations: ProjectServerOperations;
  scopes: string[];
}

@Injectable()
export class ProjectAccessCacheService {
  private readonly logger = new Logger(ProjectAccessCacheService.name);
  private readonly ttlMs: number;
  private readonly keyPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.ttlMs =
      this.configService.get<number>('app.projectAccessCacheTtlMs') || 30_000;
    this.keyPrefix =
      this.configService.get<string>('redis.keyPrefix') || 'mcdi';
  }

  async get(
    projectId: string,
    serverId: string,
  ): Promise<ProjectAccessContext | null> {
    const payload = await this.redisService.getJson<CachedAccessPayload>(
      this.entryKey(projectId, serverId),
    );

    if (!payload) {
      return null;
    }

    return {
      projectId: payload.projectId,
      serverId: payload.serverId,
      operations: payload.operations,
      scopes: payload.scopes,
    };
  }

  async set(value: ProjectAccessContext): Promise<void> {
    const entryKey = this.entryKey(value.projectId, value.serverId);

    await Promise.all([
      this.redisService.setJson(entryKey, value, this.ttlMs),
      this.redisService.sAdd(this.projectIndexKey(value.projectId), entryKey),
      this.redisService.sAdd(this.serverIndexKey(value.serverId), entryKey),
      this.redisService.expire(
        this.projectIndexKey(value.projectId),
        this.indexTtlSeconds(),
      ),
      this.redisService.expire(
        this.serverIndexKey(value.serverId),
        this.indexTtlSeconds(),
      ),
    ]);
  }

  async invalidateProject(projectId: string): Promise<void> {
    const indexKey = this.projectIndexKey(projectId);
    const members = await this.redisService.sMembers(indexKey);

    await this.redisService.delete(indexKey, ...members);

    if (members.length > 0) {
      this.logger.debug(
        `Cache: invalidated ${members.length} entr${members.length === 1 ? 'y' : 'ies'} for project ${projectId}`,
      );
    }
  }

  async invalidateServer(serverId: string): Promise<void> {
    const indexKey = this.serverIndexKey(serverId);
    const members = await this.redisService.sMembers(indexKey);

    await this.redisService.delete(indexKey, ...members);

    if (members.length > 0) {
      this.logger.debug(
        `Cache: invalidated ${members.length} entr${members.length === 1 ? 'y' : 'ies'} for server ${serverId}`,
      );
    }
  }

  async clear(): Promise<void> {
    const keys = await this.redisService.scanKeys(`${this.namespace()}:*`);
    await this.redisService.delete(...keys);
  }

  async size(): Promise<number> {
    const keys = await this.redisService.scanKeys(
      `${this.namespace()}:entry:*`,
    );
    return keys.length;
  }

  private namespace(): string {
    return `${this.keyPrefix}:project-access`;
  }

  private entryKey(projectId: string, serverId: string): string {
    return `${this.namespace()}:entry:${projectId}:${serverId}`;
  }

  private projectIndexKey(projectId: string): string {
    return `${this.namespace()}:project:${projectId}`;
  }

  private serverIndexKey(serverId: string): string {
    return `${this.namespace()}:server:${serverId}`;
  }

  private indexTtlSeconds(): number {
    return Math.ceil((this.ttlMs + INDEX_TTL_BUFFER_MS) / 1000);
  }
}
