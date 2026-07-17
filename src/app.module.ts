import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';

import { DiscordModule } from './modules/discord/discord.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ServersModule } from './modules/servers/servers.module';
import { MembersModule } from './modules/members/members.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AdminMembersModule } from './modules/admin-members/admin-members.module';
import { APP_GUARD } from '@nestjs/core';
import { ServerActiveGuard } from './modules/servers/server.guard';
import { SyncModule } from './modules/sync/sync.module';
import { AuditModule } from './modules/audit/audit.module';
import { StatsModule } from './modules/stats/stats.module';
import { MethodNotAllowedMiddleware } from './common/middleware/method-not-allowed.middleware';
import { AuditLoggingMiddleware } from './modules/audit/middleware/audit-logging.middleware';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLER_TTL_MS', 60_000),
          limit: config.get<number>('THROTTLER_LIMIT', 120),
        },
      ],
    }),
    ConfigModule,
    DatabaseModule,
    DiscordModule,
    AuthModule,
    ServersModule,
    MembersModule,
    PermissionsModule,
    ProjectsModule,
    SyncModule,
    AdminMembersModule,
    AuditModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ServerActiveGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MethodNotAllowedMiddleware).forRoutes('*');
    consumer.apply(AuditLoggingMiddleware).forRoutes('admin/*');
  }
}
