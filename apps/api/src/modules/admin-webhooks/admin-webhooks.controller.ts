import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { RequirePermission } from '../../common/decorators/admin-access.decorator';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ListWebhooksQueryDto } from '../webhooks/dto/list-webhooks-query.dto';
import {
  WebhookDetailResponseDto,
  WebhookListResponseDto,
} from '../webhooks/dto/webhook-response.dto';
import { WebhooksExceptionFilter } from '../webhooks/filters/webhooks-exception.filter';

/**
 * Admin-session oversight of project webhooks: read and delete only.
 *
 * Same `WebhooksService` as `WebhooksController`, but authenticated with the
 * `admin_session` cookie / bearer token via `AdminAccessGuard`. A System
 * Admin is not a project, so there is no ownership check. Create, update and
 * execute stay project-only: they belong to the project's own
 * `MANAGE_WEBHOOKS` grant and channel choice.
 */
@ApiTags('Webhooks')
@ApiBearerAuth('session-token')
@Controller('admin')
@UseGuards(AdminAccessGuard)
@RequirePermission('webhooks', 'read')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@UseFilters(WebhooksExceptionFilter)
export class AdminWebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('projects/:projectId/webhooks')
  @ApiOperation({
    summary: "List a project's webhooks (admin session)",
    description:
      'Returns the webhooks owned by any project, in the same shape as the ' +
      'project-facing list. Channel and server names are resolved from the ' +
      'bot cache and may be null. Tokens are never returned.',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Project ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  @ApiQuery({
    name: 'serverId',
    required: false,
    description: 'Filter by Discord server ID',
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
    description: "The project's webhooks.",
    type: WebhookListResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid project ID or query parameters.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  async listWebhooks(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListWebhooksQueryDto,
  ): Promise<WebhookListResponseDto> {
    return this.webhooksService.listWebhooksForAdmin(projectId, query);
  }

  @Get('webhooks/:webhookId')
  @ApiOperation({
    summary: 'Get webhook details (admin session)',
    description:
      'Returns a webhook owned by any project. The webhook URL and token ' +
      'are never returned.',
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
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  async getWebhook(
    @Param('webhookId') webhookId: string,
  ): Promise<WebhookDetailResponseDto> {
    return this.webhooksService.getWebhookForAdmin(webhookId);
  }

  @Delete('webhooks/:webhookId')
  @RequirePermission('webhooks', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a webhook (admin session)',
    description:
      'Deletes a webhook owned by any project, on Discord and then in ' +
      'storage. If Discord refuses, the stored webhook is kept.',
  })
  @ApiParam({
    name: 'webhookId',
    description: 'Webhook ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  @ApiNoContentResponse({ description: 'Webhook deleted.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiNotFoundResponse({ description: 'Webhook not found.' })
  @ApiBadGatewayResponse({ description: 'Discord API error.' })
  async deleteWebhook(@Param('webhookId') webhookId: string): Promise<void> {
    return this.webhooksService.deleteWebhookForAdmin(webhookId);
  }
}
