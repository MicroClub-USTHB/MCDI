import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import * as path from 'path';
import { DRIZZLE, DrizzleDB } from './database.constants';
import { servers } from './entities';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async onModuleInit() {
    this.logger.log('Running database migrations...');
    await migrate(this.db, {
      migrationsFolder: path.join(process.cwd(), 'src', 'database', 'migrations'),
    });
    this.logger.log('Migrations up to date.');

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

    this.logger.log(`Bootstrapped main server from MC_GUILD_ID env (${guildId})`);
  }
}
