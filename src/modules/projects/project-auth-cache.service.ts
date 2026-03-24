import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as schema from '../../database/entities';
import { RedisService } from '../../common/redis/redis.service';

type ProjectRow = typeof schema.projects.$inferSelect;

const INDEX_TTL_BUFFER_MS = 60_000;

interface CachedProjectPayload {
  id: string;
  name: string;
  description: string | null;
  apiKeyHash: string;
  apiKeyPrefix: string | null;
  apiKeyLastUsedAt: string | null;
  apiKeyCreatedAt: string;
  isInternal: boolean;
  webhookUrl: string | null;
  redirectUri: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProjectAuthCacheService {
  private readonly logger = new Logger(ProjectAuthCacheService.name);
  private readonly ttlMs: number;
  private readonly lastUsedWriteTtlMs: number;
  private readonly keyPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.ttlMs =
      this.configService.get<number>('app.projectAuthCacheTtlMs') || 30_000;
    this.lastUsedWriteTtlMs =
      this.configService.get<number>('app.projectLastUsedWriteTtlMs') || 60_000;
    this.keyPrefix =
      this.configService.get<string>('redis.keyPrefix') || 'mcdi';
  }

  async get(apiKey: string): Promise<ProjectRow | null> {
    const payload = await this.redisService.getJson<CachedProjectPayload>(
      this.entryKey(apiKey),
    );

    if (!payload) {
      return null;
    }

    return this.fromPayload(payload);
  }

  async set(apiKey: string, project: ProjectRow): Promise<void> {
    const entryKey = this.entryKey(apiKey);
    const indexKey = this.projectIndexKey(project.id);

    await Promise.all([
      this.redisService.setJson(entryKey, this.toPayload(project), this.ttlMs),
      this.redisService.sAdd(indexKey, entryKey),
      this.redisService.expire(indexKey, this.indexTtlSeconds()),
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

  async clear(): Promise<void> {
    const keys = await this.redisService.scanKeys(`${this.namespace()}:*`);
    await this.redisService.delete(...keys);
    if (keys.length > 0) {
      this.logger.debug(`Cache: flushed all ${keys.length} entries`);
    }
  }

  async size(): Promise<number> {
    const keys = await this.redisService.scanKeys(
      `${this.namespace()}:entry:*`,
    );
    return keys.length;
  }

  async shouldRefreshLastUsed(projectId: string): Promise<boolean> {
    return this.redisService.setNx(
      this.lastUsedGateKey(projectId),
      '1',
      this.lastUsedWriteTtlMs,
    );
  }

  private namespace(): string {
    return `${this.keyPrefix}:project-auth`;
  }

  private entryKey(apiKey: string): string {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    return `${this.namespace()}:entry:${keyHash}`;
  }

  private projectIndexKey(projectId: string): string {
    return `${this.namespace()}:project:${projectId}`;
  }

  private lastUsedGateKey(projectId: string): string {
    return `${this.namespace()}:last-used:${projectId}`;
  }

  private indexTtlSeconds(): number {
    return Math.ceil((this.ttlMs + INDEX_TTL_BUFFER_MS) / 1000);
  }

  private toPayload(project: ProjectRow): CachedProjectPayload {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      apiKeyHash: project.apiKeyHash,
      apiKeyPrefix: project.apiKeyPrefix,
      apiKeyLastUsedAt: project.apiKeyLastUsedAt?.toISOString() ?? null,
      apiKeyCreatedAt: project.apiKeyCreatedAt.toISOString(),
      isInternal: project.isInternal,
      webhookUrl: project.webhookUrl,
      redirectUri: project.redirectUri,
      isActive: project.isActive,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  private fromPayload(payload: CachedProjectPayload): ProjectRow {
    return {
      id: payload.id,
      name: payload.name,
      description: payload.description,
      apiKeyHash: payload.apiKeyHash,
      apiKeyPrefix: payload.apiKeyPrefix,
      apiKeyLastUsedAt: payload.apiKeyLastUsedAt
        ? new Date(payload.apiKeyLastUsedAt)
        : null,
      apiKeyCreatedAt: new Date(payload.apiKeyCreatedAt),
      isInternal: payload.isInternal,
      webhookUrl: payload.webhookUrl,
      redirectUri: payload.redirectUri,
      isActive: payload.isActive,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt),
    };
  }
}
