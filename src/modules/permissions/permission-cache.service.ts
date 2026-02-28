import { Injectable, Logger } from '@nestjs/common';

/** Cached resolved permission set for a (memberId, serverId) pair */
interface CacheEntry {
    permissions: string[];
    sources: {
        global: string[];
        server: string[];
        inherited: string[];
    };
    expiresAt: number;
}

/**
 * In-memory TTL cache for resolved permission sets.
 *
 * Cache key: `${memberId}:${serverId}`
 * TTL: 5 minutes (configurable via PERMISSION_CACHE_TTL_MS)
 *
 * Invalidation:
 *  - `invalidateMember(memberId)` — call when a member's roles change
 *  - `invalidateServer(serverId)` — call when a sync run completes or any role in a server changes
 *  - `clear()` — full flush
 */
@Injectable()
export class PermissionCacheService {
    private readonly logger = new Logger(PermissionCacheService.name);
    private readonly store = new Map<string, CacheEntry>();
    // Default TTL: 5 minutes
    private readonly ttlMs =
        Number(process.env.PERMISSION_CACHE_TTL_MS) || 5 * 60 * 1000;

    private key(memberId: string, serverId: string): string {
        return `${memberId}:${serverId}`;
    }

    get(
        memberId: string,
        serverId: string,
    ): CacheEntry['permissions'] extends string[]
        ? {
            permissions: string[];
            sources: { global: string[]; server: string[]; inherited: string[] };
        }
        : never | null {
        const entry = this.store.get(this.key(memberId, serverId));
        if (!entry) return null as any;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(this.key(memberId, serverId));
            return null as any;
        }
        return { permissions: entry.permissions, sources: entry.sources } as any;
    }

    set(
        memberId: string,
        serverId: string,
        value: { permissions: string[]; sources: CacheEntry['sources'] },
    ): void {
        this.store.set(this.key(memberId, serverId), {
            ...value,
            expiresAt: Date.now() + this.ttlMs,
        });
    }

    /** Invalidate all cached entries for a specific member (across all servers) */
    invalidateMember(memberId: string): void {
        const prefix = `${memberId}:`;
        let count = 0;
        for (const k of this.store.keys()) {
            if (k.startsWith(prefix)) {
                this.store.delete(k);
                count++;
            }
        }
        if (count > 0) {
            this.logger.debug(
                `Cache: invalidated ${count} entr${count === 1 ? 'y' : 'ies'} for member ${memberId}`,
            );
        }
    }

    /** Invalidate all cached entries for every member in a specific server */
    invalidateServer(serverId: string): void {
        const suffix = `:${serverId}`;
        let count = 0;
        for (const k of this.store.keys()) {
            if (k.endsWith(suffix)) {
                this.store.delete(k);
                count++;
            }
        }
        if (count > 0) {
            this.logger.debug(
                `Cache: invalidated ${count} entr${count === 1 ? 'ies' : 'ies'} for server ${serverId}`,
            );
        }
    }

    /** Full cache flush */
    clear(): void {
        const size = this.store.size;
        this.store.clear();
        this.logger.debug(`Cache: flushed all ${size} entries`);
    }

    /** Returns current cache size for diagnostics */
    size(): number {
        return this.store.size;
    }
}
