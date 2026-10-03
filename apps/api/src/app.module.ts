import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from './common/redis/redis.module';
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
import { AdminChannelsModule } from './modules/admin-channels/admin-channels.module';
import { AdminSettingsModule } from './modules/admin-settings/admin-settings.module';
import { APP_GUARD } from '@nestjs/core';
import { ServerActiveGuard } from './modules/servers/server.guard';
import { SyncModule } from './modules/sync/sync.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { AdminWebhooksModule } from './modules/admin-webhooks/admin-webhooks.module';
import { AuditModule } from './modules/audit/audit.module';
import { StatsModule } from './modules/stats/stats.module';
import { InboundWebhooksModule } from './modules/inbound-webhooks/inbound-webhooks.module';
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
    RedisModule,
    DiscordModule,
    AuthModule,
    ServersModule,
    MembersModule,
    PermissionsModule,
    ProjectsModule,
    SyncModule,
    AdminMembersModule,
    ChannelsModule,
    AdminChannelsModule,
    AdminSettingsModule,
    WebhooksModule,
    AdminWebhooksModule,
    AuditModule,
    StatsModule,
    InboundWebhooksModule,
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
    // Usage telemetry needs every route; audit rows stay limited to the admin
    // mutations in the middleware's route map.
    consumer
      .apply(AuditLoggingMiddleware)
      .exclude('health', 'docs', 'docs/{*splat}', 'docs-json', 'docs-yaml')
      .forRoutes('*');
  }
}
