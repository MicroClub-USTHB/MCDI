import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SkipGlobalThrottle } from '../../common/guards/app-throttler.guard';
import { Request } from 'express';
import { WebhooksService } from './webhooks.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ChannelAccessGuard } from '../channels/guards/channel-access.guard';
import { RequireProjectOperation } from '../../common/decorators/require-project-operation.decorator';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { ListWebhooksQueryDto } from './dto/list-webhooks-query.dto';
import { ExecuteWebhookDto } from './dto/execute-webhook.dto';
import {
  WebhookCreatedResponseDto,
  WebhookDetailResponseDto,
  WebhookListResponseDto,
} from './dto/webhook-response.dto';
import { WebhooksExceptionFilter } from './filters/webhooks-exception.filter';
import { ProjectThrottlerGuard } from '../channels/guards/project-throttler.guard';

type RequestWithProject = Request & { project?: { id: string } };

@ApiTags('Webhooks')
@ApiSecurity('api-key')
@Controller()
@UseGuards(ApiKeyGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@UseFilters(WebhooksExceptionFilter)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('servers/:serverId/channels/:channelId/webhooks')
  @RequireProjectOperation('MANAGE_WEBHOOKS')
  @UseGuards(ChannelAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a webhook for a channel',
    description:
      'Creates a Discord webhook in the channel and stores it for the project. ' +
      'The webhook URL and token are encrypted at rest and never returned.',
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
    description: 'Webhook created.',
    type: WebhookCreatedResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid name or avatar.' })
  @ApiConflictResponse({ description: 'Project webhook limit reached.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiForbiddenResponse({
    description:
      'Project does not have MANAGE_WEBHOOKS operation on this server.',
  })
  @ApiNotFoundResponse({
    description: 'Channel does not exist or bot lacks access.',
  })
  @ApiBadGatewayResponse({ description: 'Discord API error.' })
  async createWebhook(
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
    @Body() dto: CreateWebhookDto,
    @Req() req: RequestWithProject,
  ): Promise<WebhookCreatedResponseDto> {
    return this.webhooksService.createWebhook(
      serverId,
      channelId,
      req.project!.id,
      dto,
    );
  }

  @Get('projects/:projectId/webhooks')
  @ApiOperation({
    summary: 'List webhooks for a project',
    description:
      'Returns the webhooks owned by the requesting project. Channel and ' +
      'server names are resolved from the bot cache and may be null.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Project ID (must be the requesting project)',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  @ApiQuery({
    name: 'serverId',
    required: false,
    description:
      'Filter by Discord server ID. The project must have access to that server.',
    example: '123456789012345678',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of webhooks (1-100)',
    example: 50,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset',
    example: 0,
  })
  @ApiOkResponse({
    description: 'List of webhooks.',
    type: WebhookListResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiForbiddenResponse({
    description:
      'The serverId filter names a server the project cannot access.',
  })
  @ApiNotFoundResponse({
    description: 'Project not found for this API key.',
  })
  async listWebhooks(
    @Param('projectId') projectId: string,
    @Query() query: ListWebhooksQueryDto,
    @Req() req: RequestWithProject,
  ): Promise<WebhookListResponseDto> {
    return this.webhooksService.listWebhooks(req.project!.id, projectId, query);
  }

  @Get('webhooks/:webhookId')
  @ApiOperation({
    summary: 'Get webhook details',
    description:
      'Returns webhook details. The webhook must belong to the requesting project.',
  })
  @ApiParam({
    name: 'webhookId',
    description: 'Webhook ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  @ApiOkResponse({
    description: 'Webhook details.',
    type: WebhookDetailResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiNotFoundResponse({
    description: 'Webhook not found for this project.',
  })
  async getWebhook(
    @Param('webhookId') webhookId: string,
    @Req() req: RequestWithProject,
  ): Promise<WebhookDetailResponseDto> {
    return this.webhooksService.getWebhook(webhookId, req.project!.id);
  }

  @Patch('webhooks/:webhookId')
  @ApiOperation({
    summary: 'Update webhook settings',
    description:
      'Updates the webhook name and/or avatar on Discord, then in storage. ' +
      'The webhook must belong to the requesting project.',
  })
  @ApiParam({
    name: 'webhookId',
    description: 'Webhook ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  @ApiOkResponse({
    description: 'Updated webhook.',
    type: WebhookDetailResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid name or avatar.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiNotFoundResponse({
    description: 'Webhook not found for this project.',
  })
  @ApiBadGatewayResponse({ description: 'Discord API error.' })
  async updateWebhook(
    @Param('webhookId') webhookId: string,
    @Body() dto: UpdateWebhookDto,
    @Req() req: RequestWithProject,
  ): Promise<WebhookDetailResponseDto> {
    return this.webhooksService.updateWebhook(webhookId, req.project!.id, dto);
  }

  @Post('webhooks/:webhookId/execute')
  @SkipGlobalThrottle()
  @UseGuards(ProjectThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Execute a webhook',
    description:
      'Sends a message through a stored Discord webhook. The webhook must ' +
      'belong to the requesting project.',
  })
  @ApiParam({
    name: 'webhookId',
    description: 'Webhook ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  @ApiNoContentResponse({ description: 'Webhook executed.' })
  @ApiBadRequestResponse({
    description: 'Message content and embeds are both empty or invalid.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiNotFoundResponse({
    description: 'Webhook not found for this project.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Execution limit exceeded for this project.',
  })
  @ApiBadGatewayResponse({ description: 'Discord rejected every attempt.' })
  async executeWebhook(
    @Param('webhookId') webhookId: string,
    @Body() dto: ExecuteWebhookDto,
    @Req() req: RequestWithProject,
  ): Promise<void> {
    return this.webhooksService.executeWebhook(webhookId, req.project!.id, dto);
  }

  @Delete('webhooks/:webhookId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a webhook',
    description:
      'Deletes the webhook on Discord and removes it from storage. ' +
      'The webhook must belong to the requesting project.',
  })
  @ApiParam({
    name: 'webhookId',
    description: 'Webhook ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  @ApiNoContentResponse({ description: 'Webhook deleted.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key.' })
  @ApiNotFoundResponse({
    description: 'Webhook not found for this project.',
  })
  @ApiBadGatewayResponse({ description: 'Discord API error.' })
  async deleteWebhook(
    @Param('webhookId') webhookId: string,
    @Req() req: RequestWithProject,
  ): Promise<void> {
    return this.webhooksService.deleteWebhook(webhookId, req.project!.id);
  }
}
