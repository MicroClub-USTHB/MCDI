import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ServerActiveGuard,
    },
  ],
})
export class AppModule { }
