import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import { DRIZZLE, DrizzleDB } from './database.constants';

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
  }
}
