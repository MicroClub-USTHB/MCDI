/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { SyncService } from './sync.service';
import { Client, GuildMember, User } from 'discord.js';

@Injectable()
export class SyncListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncListener.name);
  private client: Client;

  constructor(
    private readonly discordService: DiscordService,
    private readonly syncService: SyncService,
  ) {
    this.client = this.discordService.getClient();
  }

  onModuleInit() {
    this.logger.log('Registering Discord event listeners for sync');

    this.client.on('guildMemberAdd', this.handleGuildMemberAdd.bind(this));
    this.client.on(
      'guildMemberRemove',
      this.handleGuildMemberRemove.bind(this),
    );
    this.client.on(
      'guildMemberUpdate',
      this.handleGuildMemberUpdate.bind(this),
    );
    this.client.on('userUpdate', this.handleUserUpdate.bind(this));
  }

  onModuleDestroy() {
    this.logger.log('Removing Discord event listeners');
    this.client.removeAllListeners('guildMemberAdd');
    this.client.removeAllListeners('guildMemberRemove');
    this.client.removeAllListeners('guildMemberUpdate');
    this.client.removeAllListeners('userUpdate');
  }

  private async handleGuildMemberAdd(member: GuildMember): Promise<void> {
    try {
      await this.syncService.handleMemberAdd(member);
    } catch (error) {
      this.logger.error(
        `Error in guildMemberAdd handler: ${error.message}`,
        error.stack,
      );
    }
  }

  private async handleGuildMemberRemove(member: GuildMember): Promise<void> {
    try {
      await this.syncService.handleMemberRemove(member);
    } catch (error) {
      this.logger.error(
        `Error in guildMemberRemove handler: ${error.message}`,
        error.stack,
      );
    }
  }

  private async handleGuildMemberUpdate(
    oldMember: GuildMember,
    newMember: GuildMember,
  ): Promise<void> {
    try {
      await this.syncService.handleMemberUpdate(oldMember, newMember);
    } catch (error) {
      this.logger.error(
        `Error in guildMemberUpdate handler: ${error.message}`,
        error.stack,
      );
    }
  }

  private async handleUserUpdate(oldUser: User, newUser: User): Promise<void> {
    try {
      await this.syncService.handleUserUpdate(oldUser, newUser);
    } catch (error) {
      this.logger.error(
        `Error in userUpdate handler: ${error.message}`,
        error.stack,
      );
    }
  }
}
