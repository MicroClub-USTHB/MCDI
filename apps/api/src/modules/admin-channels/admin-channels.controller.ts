import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChannelsService } from '../channels/channels.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { ListChannelsQueryDto } from '../channels/dto/list-channels-query.dto';
import { ListMessagesQueryDto } from '../channels/dto/list-messages-query.dto';
import {
  ChannelListResponseDto,
  ChannelDetailResponseDto,
} from '../channels/dto/channel-response.dto';
import { GetMessagesResponseDto } from '../channels/dto/message-response.dto';
import { ChannelsExceptionFilter } from '../channels/filters/channels-exception.filter';

/**
 * Admin-session, read-only mirror of the project channel GET routes.
 *
 * Same `ChannelsService` read logic as `ChannelsController`, but authenticated
 * with the `admin_session` cookie / bearer token via `SystemAdminGuard`. A
 * System Admin is not a project and sees every server, so `ChannelAccessGuard`
 * (per-project channel grant) and `ProjectThrottlerGuard` (per-project rate
 * limit) do not apply — the Discord-proxying `messages` route keeps a plain
 * IP-keyed `@Throttle` override of the global limit instead.
 */
@ApiTags('Channels')
@ApiBearerAuth('session-token')
@Controller('admin/servers/:serverId/channels')
@UseGuards(SystemAdminGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@UseFilters(ChannelsExceptionFilter)
export class AdminChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all channels in a server (admin session)',
    description:
      'Returns all channels the bot can access in the server, with categories.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['all', 'text', 'voice', 'announcement', 'category'],
    description: 'Filter by channel type',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by parent category ID',
    example: '123456789012345678',
  })
  @ApiOkResponse({
    description: 'List of channels and categories.',
    type: ChannelListResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiNotFoundResponse({
    description: 'Server not found or bot not connected.',
  })
  async listChannels(
    @Param('serverId') serverId: string,
    @Query() query: ListChannelsQueryDto,
  ): Promise<ChannelListResponseDto> {
    return this.channelsService.listChannels(serverId, query);
  }

  @Get(':channelId')
  @ApiOperation({
    summary: 'Get channel details (admin session)',
    description:
      'Returns detailed information about a specific channel, including its permission overwrites.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'channelId',
    description: 'Discord channel ID',
    example: '123456789012345678',
  })
  @ApiOkResponse({
    description: 'Channel details.',
    type: ChannelDetailResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid channel ID format.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiNotFoundResponse({
    description: 'Channel does not exist or bot lacks access.',
  })
  async getChannel(
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
  ): Promise<ChannelDetailResponseDto> {
    return this.channelsService.getChannel(serverId, channelId);
  }

  @Get(':channelId/messages')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Get recent messages from a channel (admin session)',
    description:
      'Retrieves message history from a text channel. Read-only; supports pagination and author filtering.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'channelId',
    description: 'Discord channel ID',
    example: '123456789012345678',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of messages (1-100)',
    example: 50,
  })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    description: 'Get messages before this Discord snowflake ID',
    example: '123456789012345678',
  })
  @ApiQuery({
    name: 'after',
    required: false,
    type: String,
    description: 'Get messages after this Discord snowflake ID',
    example: '123456789012345678',
  })
  @ApiQuery({
    name: 'authorId',
    required: false,
    type: String,
    description: 'Filter by author Discord ID',
    example: '123456789012345678',
  })
  @ApiOkResponse({
    description: 'List of messages.',
    type: GetMessagesResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiNotFoundResponse({
    description: 'Channel does not exist or bot lacks access.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded. 30 requests per minute.',
  })
  async getMessages(
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<GetMessagesResponseDto> {
    return this.channelsService.getMessages(serverId, channelId, query);
  }
}
