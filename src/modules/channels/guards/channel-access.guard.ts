import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { DiscordService } from '../../discord/discord.service';

@Injectable()
export class ChannelAccessGuard implements CanActivate {
  private readonly logger = new Logger(ChannelAccessGuard.name);

  constructor(private readonly discordService: DiscordService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const serverId = this.paramAsString(request.params['serverId']);
    const channelId = this.paramAsString(request.params['channelId']);

    if (!channelId) {
      return true;
    }

    const channel = await this.discordService.getChannelById(channelId);

    if (!channel) {
      throw new NotFoundException(
        'CHANNEL_NOT_FOUND: Channel does not exist or bot lacks access',
      );
    }

    if (channel.isDMBased()) {
      throw new ForbiddenException(
        'CHANNEL_NOT_FOUND: Cannot access DM channels',
      );
    }

    if (channel.guildId !== serverId) {
      throw new NotFoundException(
        'CHANNEL_NOT_FOUND: Channel does not exist in this server',
      );
    }

    return true;
  }

  /** Route params can type as `string | string[]` — collapse to a single string. */
  private paramAsString(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
