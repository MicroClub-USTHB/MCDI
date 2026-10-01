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
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { InboundWebhooksService } from './inbound-webhooks.service';
import type { DocsFormat } from './inbound-webhooks.service';
import { CreateInboundWebhookDto } from './dto/create-inbound-webhook.dto';
import { UpdateInboundWebhookDto } from './dto/update-inbound-webhook.dto';
import { SetAllowedRolesDto } from './dto/set-allowed-roles.dto';

type RequestWithUser = Request & {
  memberId?: string;
  user?: { id?: string; email?: string; username?: string };
};

@ApiTags('Inbound Webhooks (Admin)')
@ApiBearerAuth('session-token')
@Controller('admin/inbound-webhooks')
@UseGuards(SystemAdminGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class InboundWebhooksController {
  constructor(private readonly service: InboundWebhooksService) {}

  private actor(req: RequestWithUser): string | null {
    return req.memberId ?? req.user?.id ?? null;
  }

  @Post()
  @ApiOperation({
    summary: 'Create an inbound webhook',
    description:
      'The schema is validated up front. At least one allowed Discord role is required — ' +
      'unlike project_roles, an empty role set means nobody, not everybody. ' +
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
  @ApiOperation({ summary: 'List inbound webhooks' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiOkResponse({ description: 'Webhooks, newest first.' })
  async list(@Query('projectId') projectId?: string) {
    return this.service.listAll(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one inbound webhook' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'No such webhook.' })
  async get(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get(':id/docs')
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
  @ApiOperation({
    summary: 'List the Discord roles permitted to read submissions',
  })
  async listRoles(@Param('id') id: string) {
    return this.service.getAllowedRoles(id);
  }

  @Put(':id/roles')
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete an inbound webhook and all its submissions',
  })
  @ApiNoContentResponse({ description: 'Deleted.' })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    await this.service.delete(id, this.actor(req));
  }
}
