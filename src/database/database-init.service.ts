import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
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
}
