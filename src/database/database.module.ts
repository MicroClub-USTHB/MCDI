import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './entities';
import { DatabaseInitService } from './database-init.service';
import { DRIZZLE, DATABASE_POOL, DrizzleDB } from './database.constants';

export { DRIZZLE, DATABASE_POOL };
export type { DrizzleDB };

class DatabasePoolCleanupService implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('database.url');
        return new Pool({ connectionString: databaseUrl });
      },
    },
    {
      provide: DRIZZLE,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
    DatabasePoolCleanupService,
    DatabaseInitService,
  ],
  exports: [DRIZZLE, DATABASE_POOL],
})
export class DatabaseModule {}
