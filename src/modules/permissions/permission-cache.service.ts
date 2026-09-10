import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { SettingsService } from '../admin-settings/settings.service';

const INDEX_TTL_BUFFER_MS = 60_000;

/** Cached resolved permission set for a (memberId, serverId) pair */
export interface CachedPermissions {
  permissions: string[];
  sources: {
    global: string[];
    server: string[];
    hierarchy: string[];
    inherited: string[];
  };
}

/**
 * Redis-backed TTL cache for resolved permission sets.
 *
 * Cache key:     {keyPrefix}:perm-cache:entry:{memberId}:{serverId}
 * Member index:  {keyPrefix}:perm-cache:idx:member:{memberId}
 * Server index:  {keyPrefix}:perm-cache:idx:server:{serverId}
 * TTL: 5 minutes (configurable via app.permissionCacheTtlMs)
 *
 * Invalidation:
 *  - `invalidateMember(memberId)` — call when a member's roles change
 *  - `invalidateServer(serverId)` — call when a sync run completes or any role in a server changes
 *  - `clear()` — full flush
 *
 * Gracefully falls back to DB path when Redis is unavailable.
 */
@Injectable()
export class PermissionCacheService implements OnModuleInit {
  private readonly logger = new Logger(PermissionCacheService.name);
  private readonly keyPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly settings: SettingsService,
  ) {
    this.keyPrefix =
      this.configService.get<string>('redis.keyPrefix') || 'mcdi';
  }

  onModuleInit(): void {
    // Only a *decrease* needs a flush: shrinking the TTL doesn't re-expire
    // entries already written on the old, longer TTL. An increase is harmless
    // and flushing it would needlessly cold-start every permission lookup.
    this.settings.registerChangeListener(async (changes) => {
      const ttl = changes.find((c) => c.key === 'permissionCacheTtlMs');
      if (ttl && ttl.to < ttl.from) {
        await this.clear();
      }
    });
  }

  /** Effective permission-cache TTL, read live from SettingsService. */
  private get ttlMs(): number {
    return this.settings.getPermissionCacheTtlMs();
  }

  private namespace(): string {
    return `${this.keyPrefix}:perm-cache`;
  }

  private entryKey(memberId: string, serverId: string): string {
    return `${this.namespace()}:entry:${memberId}:${serverId}`;
  }

  private memberIndexKey(memberId: string): string {
    return `${this.namespace()}:idx:member:${memberId}`;
  }

  private serverIndexKey(serverId: string): string {
    return `${this.namespace()}:idx:server:${serverId}`;
  }

  private indexTtlSeconds(): number {
    return Math.ceil((this.ttlMs + INDEX_TTL_BUFFER_MS) / 1000);
  }

  async get(
    memberId: string,
    serverId: string,
  ): Promise<CachedPermissions | null> {
    return this.redisService.getJson<CachedPermissions>(
      this.entryKey(memberId, serverId),
    );
  }

  async set(
    memberId: string,
    serverId: string,
    value: CachedPermissions,
  ): Promise<void> {
    const entryKey = this.entryKey(memberId, serverId);

    await Promise.all([
      this.redisService.setJson(entryKey, value, this.ttlMs),
      this.redisService.sAdd(this.memberIndexKey(memberId), entryKey),
      this.redisService.sAdd(this.serverIndexKey(serverId), entryKey),
      this.redisService.expire(
        this.memberIndexKey(memberId),
        this.indexTtlSeconds(),
      ),
      this.redisService.expire(
        this.serverIndexKey(serverId),
        this.indexTtlSeconds(),
      ),
    ]);
  }

  /** Invalidate all cached entries for a specific member (across all servers) */
  async invalidateMember(memberId: string): Promise<void> {
    const indexKey = this.memberIndexKey(memberId);
    const members = await this.redisService.sMembers(indexKey);

    await this.redisService.delete(indexKey, ...members);

    if (members.length > 0) {
      this.logger.debug(
        `Cache: invalidated ${members.length} entr${members.length === 1 ? 'y' : 'ies'} for member ${memberId}`,
      );
    }
  }

  /** Invalidate all cached entries for every member in a specific server */
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

  /** Full cache flush */
  async clear(): Promise<void> {
    const keys = await this.redisService.scanKeys(`${this.namespace()}:*`);
    await this.redisService.delete(...keys);
    if (keys.length > 0) {
      this.logger.debug(`Cache: flushed all ${keys.length} entries`);
    }
  }

  /** Returns current cache size for diagnostics */
  async size(): Promise<number> {
    const keys = await this.redisService.scanKeys(
      `${this.namespace()}:entry:*`,
    );
    return keys.length;
  }
}
