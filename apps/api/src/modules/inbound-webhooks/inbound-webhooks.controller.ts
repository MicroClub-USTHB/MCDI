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
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { RequirePermission } from '../../common/decorators/admin-access.decorator';
import { InboundWebhooksService } from './inbound-webhooks.service';
import type { DocsFormat } from './inbound-webhooks.service';
import { CreateInboundWebhookDto } from './dto/create-inbound-webhook.dto';
import { UpdateInboundWebhookDto } from './dto/update-inbound-webhook.dto';
import { SetAllowedRolesDto } from './dto/set-allowed-roles.dto';
import { UpdateInboundWebhookSettingsDto } from './dto/update-inbound-webhook-settings.dto';
import { PreviewInboundWebhookSchemaDto } from './dto/preview-inbound-webhook-schema.dto';

type RequestWithUser = Request & {
  memberId?: string;
  user?: { id?: string; email?: string; username?: string };
};

@ApiTags('Inbound Webhooks (Admin)')
@ApiBearerAuth('session-token')
@Controller('admin/inbound-webhooks')
@UseGuards(AdminAccessGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class InboundWebhooksController {
  constructor(private readonly service: InboundWebhooksService) {}

  private actor(req: RequestWithUser): string | null {
    return req.memberId ?? req.user?.id ?? null;
  }

  @Post()
  @RequirePermission('inbound_webhooks', 'write')
  @ApiOperation({
    summary: 'Create an inbound webhook',
    description:
      'The schema is validated up front. Name the Discord roles that may read submissions, or omit ' +
      '`allowedRoleIds` to use the default reader roles (MC Executive unless changed in the settings). ' +
      'At least one role must result — unlike project_roles, an empty role set means nobody, not everybody. ' +
      'The signing secret is returned exactly once.',
  })
  @ApiCreatedResponse({ description: 'Created; signingSecret returned once.' })
  @ApiBadRequestResponse({
    description: 'Invalid schema, or unknown/foreign roles.',
  })
  @ApiConflictResponse({ description: 'Slug already used by this project.' })
  async create(
    @Body() dto: CreateInboundWebhookDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(dto, this.actor(req));
  }

  @Get()
  @RequirePermission('inbound_webhooks', 'read')
  @ApiOperation({ summary: 'List inbound webhooks' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOkResponse({ description: 'Webhooks, newest first.' })
  async list(@Query('projectId') projectId?: string) {
    return this.service.listAll(projectId);
  }

  // Declared before `:id` so "settings" is never read as a webhook id.
  @Get('settings')
  @RequirePermission('inbound_webhooks', 'read')
  @ApiOperation({
    summary: 'Get the inbound webhook settings',
    description:
      'The default reader roles new webhooks get when their creator names none. ' +
      '`source` is `environment` until the setting is first saved, when it falls back to the executive role.',
  })
  @ApiOkResponse({ description: 'The effective settings.' })
  async getSettings() {
    return this.service.getSettings();
  }

  @Put('settings')
  @RequirePermission('inbound_webhooks', 'write')
  @ApiOperation({
    summary: 'Replace the default reader roles',
    description:
      'Applies to webhooks created afterwards; existing webhooks keep their roles. ' +
      'An empty list means no defaults.',
  })
  @ApiOkResponse({ description: 'The settings after the change.' })
  @ApiBadRequestResponse({ description: 'Unknown role IDs.' })
  async updateSettings(
    @Body() dto: UpdateInboundWebhookSettingsDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.updateSettings(
      dto.defaultReaderRoleIds,
      this.actor(req),
    );
  }

  @Post('schema/preview')
  @RequirePermission('inbound_webhooks', 'read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check a schema and preview its docs',
    description:
      'Runs the same validator as create without saving anything, for the admin schema editor. ' +
      'An invalid schema is a normal 200 with `ok: false` and every problem with its path; a ' +
      'valid one returns the generated developer docs and an example payload, with placeholders ' +
      'for what only exists once the webhook is saved (its ID and readers). Nothing is stored or audited.',
  })
  @ApiOkResponse({
    description:
      '`{ ok: false, errors: [{ path, code, message }] }` or `{ ok: true, markdown, examplePayload }`.',
  })
  @ApiBadRequestResponse({ description: 'The request itself is malformed.' })
  previewSchema(@Body() dto: PreviewInboundWebhookSchemaDto) {
    return this.service.previewSchema(dto);
  }

  @Get(':id')
  @RequirePermission('inbound_webhooks', 'read')
  @ApiOperation({ summary: 'Get one inbound webhook' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'No such webhook.' })
  async get(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/docs')
  @RequirePermission('inbound_webhooks', 'read')
  @ApiOperation({
    summary: 'Export developer documentation for this webhook',
    description:
      'Generated from the live schema, so it can never drift from what the validator enforces. ' +
      'Markdown is a ready-to-share integration guide (endpoint, auth, signing code in JS and ' +
      'Python, every field with its constraints, an example payload, the full error table, and ' +
      'who may read submissions). OpenAPI is an importable 3.1 spec for Postman, Insomnia or ' +
      'client codegen.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['markdown', 'openapi'],
    description: 'Defaults to markdown.',
  })
  @ApiQuery({
    name: 'download',
    required: false,
    description: 'Set to "true" to receive it as a file attachment.',
  })
  @ApiOkResponse({ description: 'The rendered documentation.' })
  @ApiNotFoundResponse({ description: 'No such webhook.' })
  async exportDocs(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('download') download?: string,
  ) {
    const chosen: DocsFormat = format === 'openapi' ? 'openapi' : 'markdown';
    const doc = await this.service.generateDocs(id, chosen);

    res.setHeader('Content-Type', doc.contentType);
    if (download === 'true') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${doc.filename}"`,
      );
    }
    res.send(doc.body);
  }

  @Patch(':id')
  @RequirePermission('inbound_webhooks', 'write')
  @ApiOperation({ summary: 'Update an inbound webhook' })
  @ApiBadRequestResponse({ description: 'Invalid schema.' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInboundWebhookDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, this.actor(req));
  }

  @Get(':id/roles')
  @RequirePermission('inbound_webhooks', 'read')
  @ApiOperation({
    summary: 'List the Discord roles permitted to read submissions',
  })
  async listRoles(@Param('id') id: string) {
    return this.service.getAllowedRoles(id);
  }

  @Put(':id/roles')
  @RequirePermission('inbound_webhooks', 'write')
  @ApiOperation({
    summary: 'Replace the read-access role grants',
    description:
      'The set can never be emptied — removing the last role is a deletion of the webhook.',
  })
  @ApiBadRequestResponse({
    description: 'Empty set, or unknown/foreign roles.',
  })
  async replaceRoles(
    @Param('id') id: string,
    @Body() dto: SetAllowedRolesDto,
    @Req() req: RequestWithUser,
  ) {
    const roleIds = await this.service.replaceAllowedRoles(
      id,
      dto.roleIds,
      this.actor(req),
    );
    return { roleIds };
  }

  @Post(':id/rotate-secret')
  @RequirePermission('inbound_webhooks', 'write')
  @ApiOperation({
    summary: 'Rotate the signing secret',
    description:
      'Returned exactly once. Previously issued signatures stop verifying.',
  })
  async rotateSecret(@Param('id') id: string, @Req() req: RequestWithUser) {
    const signingSecret = await this.service.rotateSecret(id, this.actor(req));
    return { signingSecret };
  }

  @Delete(':id')
  @RequirePermission('inbound_webhooks', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an inbound webhook and all its submissions',
  })
  @ApiNoContentResponse({ description: 'Deleted.' })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.service.delete(id, this.actor(req));
  }
}
