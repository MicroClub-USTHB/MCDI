import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RedisModule } from '../../common/redis/redis.module';
import { DiscordModule } from '../discord/discord.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { StatsRepository } from './stats.repository';

@Module({
  imports: [DatabaseModule, RedisModule, DiscordModule],
  controllers: [StatsController],
  providers: [StatsService, StatsRepository],
  exports: [StatsService],
})
export class StatsModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly statsService: StatsService) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== 'test') {
      this.statsService.startDailyRefreshSchedule();
    }
  }

  onModuleDestroy() {
    this.statsService.stopDailyRefreshSchedule();
  }
}
