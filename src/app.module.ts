import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordModule } from './discord/discord.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ServersModule } from './modules/servers/servers.module';
import { MembersModule } from './modules/members/members.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { AdminMembersModule } from './modules/admin-members/admin-members.module';

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
    AdminMembersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
