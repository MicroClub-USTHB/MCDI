import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { eq, sql } from 'drizzle-orm';
import * as path from 'path';
import { existsSync } from 'fs';
import { DRIZZLE, DrizzleDB } from './database.constants';
import { servers } from './entities';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async onModuleInit() {
    const migrationsFolder = path.join(
      process.cwd(),
      'src',
      'database',
      'migrations',
    );
    if (existsSync(migrationsFolder)) {
      this.logger.log('Running database migrations...');
      await migrate(this.db, { migrationsFolder });
      this.logger.log('Migrations up to date.');
    } else {
      this.logger.warn(
        `Migrations folder not found at "${migrationsFolder}" — ` +
          'skipping auto-migration (assumes db:migrate ran before boot).',
      );
    }

    await this.bootstrapMainServer();
    await this.checkMainServer();
  }

  private async bootstrapMainServer(): Promise<void> {
    const guildId = process.env.MC_GUILD_ID;
    if (!guildId) {
      return;
    }

    const [row] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(servers);

    if (row.count > 0) {
      return;
    }

    await this.db.insert(servers).values({
      id: guildId,
      name: guildId,
      isMain: true,
      isActive: true,
      syncFrequencyHours: 1,
      defaultPermissionPolicy: 'deny_all',
    });

    this.logger.log(
      `Bootstrapped main server from MC_GUILD_ID env (${guildId})`,
    );
  }

  /**
   * Admin login uses MC_GUILD_ID while the permission guard uses the server
   * flagged is_main, so the two must name the same guild. A mismatch fails the
   * boot in production and logs a warning elsewhere.
   */
  async checkMainServer(): Promise<void> {
    const guildId = process.env.MC_GUILD_ID;
    if (!guildId) return;

    const [main] = await this.db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.isMain, true));
    if (!main || main.id === guildId) return;

    const message =
      `The main server in the database (${main.id}) differs from MC_GUILD_ID ` +
      `(${guildId}). Admin login and the permission guard would use different ` +
      'servers. Change MC_GUILD_ID or set the right server as main.';
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(message);
      throw new Error(message);
    }
    this.logger.warn(message);
  }
}
