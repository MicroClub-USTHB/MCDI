import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChannelsService } from './channels.service';
import { ChannelAccessGuard } from './guards/channel-access.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireProjectOperation } from '../../common/decorators/require-project-operation.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { ListChannelsQueryDto } from './dto/list-channels-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { SendMessageResponseDto } from './dto/message-response.dto';
import { ChannelListResponseDto, ChannelDetailResponseDto } from './dto/channel-response.dto';
import { GetMessagesResponseDto } from './dto/message-response.dto';

@ApiTags('Channels')
@ApiSecurity('api-key')
@Controller('servers/:serverId/channels')
@UseGuards(ApiKeyGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @RequireProjectOperation('READ')
  @ApiOperation({
    summary: 'List all channels in a server',
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
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiForbiddenResponse({
    description: 'Project does not have READ access to this server.',
  })
  @ApiNotFoundResponse({ description: 'Server not found or bot not connected.' })
  async listChannels(
    @Param('serverId') serverId: string,
    @Query() query: ListChannelsQueryDto,
  ): Promise<ChannelListResponseDto> {
    return this.channelsService.listChannels(serverId, query);
  }

  @Get(':channelId')
  @RequireProjectOperation('READ')
  @UseGuards(ChannelAccessGuard)
  @ApiOperation({
    summary: 'Get channel details',
    description: 'Returns detailed information about a specific channel.',
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
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiForbiddenResponse({
    description: 'Project does not have READ access to this server.',
  })
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
  @RequireProjectOperation('READ')
  @UseGuards(ChannelAccessGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: 'Get recent messages from a channel',
    description:
      'Retrieves message history from a text channel. Supports pagination and author filtering.',
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
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiForbiddenResponse({
    description: 'Project does not have READ access to this server.',
  })
  @ApiNotFoundResponse({
    description: 'Channel does not exist or bot lacks access.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded. 10 requests per minute per project.',
  })
  async getMessages(
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<GetMessagesResponseDto> {
    return this.channelsService.getMessages(serverId, channelId, query);
  }

  @Post(':channelId/messages')
  @RequireProjectOperation('SEND_MESSAGES')
  @UseGuards(ChannelAccessGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send a message to a Discord channel',
    description:
      'Sends a message with optional embeds and mention configuration.',
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
  @ApiCreatedResponse({
    description: 'Message sent successfully.',
    type: SendMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid message content or embed validation failed.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiForbiddenResponse({
    description:
      'Project does not have SEND_MESSAGES operation on this server.',
  })
  @ApiNotFoundResponse({
    description: 'Channel does not exist or bot lacks access.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded. 5 messages per minute per project.',
  })
  async sendMessage(
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
    @Body() dto: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    return this.channelsService.sendMessage(serverId, channelId, dto);
  }
}
