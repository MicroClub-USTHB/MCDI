import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../common/redis/redis.module';
import { DiscordModule } from '../discord/discord.module';
import { AuditController, MonitoringController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditRepository } from './audit.repository';

@Module({
  imports: [DatabaseModule, RedisModule, DiscordModule],
  controllers: [AuditController, MonitoringController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService, AuditRepository],
})
export class AuditModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly auditService: AuditService) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      this.auditService.startCleanupSchedule();
    }
  }

  onModuleDestroy() {
    this.auditService.stopCleanupSchedule();
  }
}
