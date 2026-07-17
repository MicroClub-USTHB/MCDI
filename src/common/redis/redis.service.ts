import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisClientType, createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;
  private lastErrorSignature: string | null = null;
  private lastErrorAt = 0;
  private connectPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('redis.url');

    this.client = url
      ? createClient({ url })
      : createClient({
          socket: {
            host: this.configService.get<string>('redis.host') || 'localhost',
            port: this.configService.get<number>('redis.port') || 6379,
            reconnectStrategy: (retries) => Math.min(retries * 250, 2_000),
          },
          password: this.configService.get<string>('redis.password'),
          database: this.configService.get<number>('redis.database') || 0,
        });

    this.client.on('error', (error) => {
      this.logRedisError(error);
    });
  }

  onModuleInit(): void {
    if (this.client.isOpen || this.connectPromise) {
      return;
    }

    // Do not block Nest bootstrap on Redis availability.
    this.connectPromise = this.client
      .connect()
      .then(() => {
        this.logger.log('Redis cache connected');
      })
      .catch((error) => {
        this.logRedisError(error, 'Redis cache unavailable at startup');
      })
      .finally(() => {
        this.connectPromise = null;
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    if (!this.client.isReady) {
      void this.client.disconnect();
      return;
    }

    try {
      await this.client.quit();
    } catch {
      void this.client.disconnect();
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.run<string | null>(() => this.client.get(key));
    if (!raw || typeof raw !== 'string') {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logRedisError(
        error,
        `Failed to parse cached JSON payload for key ${key}`,
      );
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.run(() =>
      this.client.set(key, JSON.stringify(value), { PX: ttlMs }),
    );
  }

  async setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
    const result = await this.run(() =>
      this.client.set(key, value, { PX: ttlMs, NX: true }),
    );
    return result === 'OK';
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const deleted = await this.run(() => this.client.del(keys));
    return typeof deleted === 'number' ? deleted : 0;
  }

  async sAdd(key: string, ...members: string[]): Promise<void> {
    if (members.length === 0) {
      return;
    }

    await this.run(() => this.client.sAdd(key, members));
  }

  async sMembers(key: string): Promise<string[]> {
    const members = await this.run(() => this.client.sMembers(key));
    return Array.isArray(members) ? members : [];
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.run(() => this.client.expire(key, ttlSeconds));
  }

  get isAvailable(): boolean {
    return this.client.isReady;
  }

  async ping(): Promise<boolean> {
    const result = await this.run(() => this.client.ping());
    return result === 'PONG';
  }

  async incr(key: string): Promise<number> {
    const result = await this.run(() => this.client.incr(key));
    return typeof result === 'number' ? result : 0;
  }

  async hIncrBy(
    key: string,
    field: string,
    increment: number,
  ): Promise<number> {
    const result = await this.run(() =>
      this.client.hIncrBy(key, field, increment),
    );
    return typeof result === 'number' ? result : 0;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const result = await this.run(() => this.client.hGetAll(key));
    return result && typeof result === 'object'
      ? (result as Record<string, string>)
      : {};
  }

  async scanKeys(pattern: string): Promise<string[]> {
    if (!this.client.isReady) {
      return [];
    }

    try {
      const keys: string[] = [];
      for await (const key of this.client.scanIterator({
        MATCH: pattern,
        COUNT: 100,
      })) {
        keys.push(String(key));
      }
      return keys;
    } catch (error) {
      this.logRedisError(error);
      return [];
    }
  }

  private async run<T>(operation: () => Promise<T>): Promise<T | null> {
    if (!this.client.isReady) {
      return null;
    }

    try {
      return await operation();
    } catch (error) {
      this.logRedisError(error);
      return null;
    }
  }

  private logRedisError(error: unknown, prefix = 'Redis cache unavailable') {
    const signature =
      error instanceof Error ? `${error.name}:${error.message}` : String(error);
    const now = Date.now();

    if (
      signature === this.lastErrorSignature &&
      now - this.lastErrorAt < 30_000
    ) {
      return;
    }

    this.lastErrorSignature = signature;
    this.lastErrorAt = now;
    this.logger.warn(`${prefix}. Falling back to database path. ${signature}`);
  }
}
