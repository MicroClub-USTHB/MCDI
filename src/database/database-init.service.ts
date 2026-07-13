import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import * as schema from './entities';
import { initialSeeder } from './seeders/initial.seeder';
import { adminSeeder } from './seeders/admin.seeder';
import { DRIZZLE, DrizzleDB } from './database.constants';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async onModuleInit() {
    await this.runMigrations();
    await this.runSeedersIfNeeded();
  }

  private async runMigrations() {
    this.logger.log('Running database migrations...');
    await migrate(this.db, {
      migrationsFolder: path.join(process.cwd(), 'src', 'database', 'migrations'),
    });
    this.logger.log('Migrations up to date.');
  }

  private async runSeedersIfNeeded() {
    const [existing] = await this.db
      .select()
      .from(schema.permissions)
      .limit(1);

    if (existing) {
      this.logger.log('Database already seeded, skipping.');
      return;
    }

    this.logger.log('Seeding database for the first time...');
    await initialSeeder(this.db);
    await adminSeeder(this.db);
    this.logger.log('Database seeding complete.');
  }
}
