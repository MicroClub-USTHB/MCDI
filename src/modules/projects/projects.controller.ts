import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
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
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateRedirectUriDto } from './dto/update-redirect-uri.dto';
import { SetProjectServerAccessDto } from './dto/set-project-server-access.dto';

type RequestWithUser = Request & {
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
};

@ApiTags('Admin Projects')
@ApiBearerAuth('session-token')
@Controller('admin/projects')
@UseGuards(SystemAdminGuard)
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ProjectsController {
  private static readonly DEFAULT_AUDIT_LIMIT = 100;

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly configService: ConfigService,
  ) {}

  private resolveActor(req: RequestWithUser): string {
    return (
      req.user?.id ??
      req.user?.email ??
      req.user?.username ??
      (this.configService.get<string>('app.nodeEnv') === 'development'
        ? 'dev-admin'
        : 'unknown-admin')
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create a project',
    description:
      'Registers a new project and returns its API key. The full key is returned once and never stored — save it immediately.',
  })
  @ApiBody({ type: CreateProjectDto })
  @ApiCreatedResponse({
    description: 'Project created. API key returned once.',
    schema: {
      example: {
        apiKey: 'mcdi_pk_live_ab12cd34.64hexsecret...',
        project: {
          id: 'uuid',
          name: 'MicroClub Website',
          description: 'Main website',
          apiKeyPrefix: 'mcdi_pk_live_ab12cd34',
          isActive: true,
          scopes: ['read_members'],
          createdAt: '2026-02-20T00:00:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Validation error.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects' })
  @ApiOkResponse({ description: 'Projects retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiOkResponse({ description: 'Project retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiOkResponse({ description: 'Project updated successfully.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Post(':id/regenerate-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate API key',
    description:
      'Generates a new API key. The old key is immediately invalid. New key is returned once — save it.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiOkResponse({
    description: 'New API key generated. Old key is now invalid.',
    schema: { example: { apiKey: 'mcdi_pk_live_xy98zw76.64hexsecret...' } },
  })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  regenerateKey(@Param('id') id: string) {
    return this.projectsService.regenerateKey(id);
  }

  @Delete(':id/key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiNoContentResponse({ description: 'API key revoked.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  revokeKey(@Param('id') id: string) {
    return this.projectsService.revokeKey(id);
  }

  @Post(':id/restore-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore a revoked API key' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiNoContentResponse({ description: 'API key restored.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  restoreKey(@Param('id') id: string) {
    return this.projectsService.restoreKey(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiNoContentResponse({ description: 'Project deleted.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }

  // ── Admin-only operations ────────────────────────────────────────────

  @Post(':id/regenerate-api-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate project API key (admin)',
    description:
      'Generates a new API key. The old key is immediately invalidated. Returns full key metadata.',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiOkResponse({
    description: 'API key regenerated successfully.',
    schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        apiKey: {
          type: 'string',
          example: 'mcdi_pk_live_xy98zw76.64hexsecret...',
        },
        apiKeyPrefix: { type: 'string', example: 'mcdi_pk_live_xy98zw76' },
        apiKeyCreatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  regenerateApiKeyAdmin(@Param('id') id: string) {
    return this.projectsService.regenerateApiKeyAdmin(id);
  }

  @Patch(':id/redirect-uri')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update allowed redirect URI(s)',
    description:
      'Sets the redirect URI(s) allowed for this project. ' +
      'Accepts a single URI or a comma-separated list. ' +
      'The value passed to POST /auth/login-session must exactly match one of these.',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateRedirectUriDto })
  @ApiOkResponse({
    description: 'Redirect URI updated.',
    schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        redirectUri: {
          type: 'string',
          example: 'https://events.microclub.net/auth/callback',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  updateRedirectUri(
    @Param('id') id: string,
    @Body() dto: UpdateRedirectUriDto,
  ) {
    return this.projectsService.updateRedirectUri(id, dto);
  }

  // ─── Project-Server Access ─────────────────────────────────────────

  @Put(':projectId/servers/:serverId')
  @ApiOperation({ summary: 'Grant or update project access to a server' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiBody({ type: SetProjectServerAccessDto })
  @ApiOkResponse({ description: 'Access mapping upserted.' })
  @ApiNotFoundResponse({ description: 'Project or server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  setProjectServerAccess(
    @Param('projectId') projectId: string,
    @Param('serverId') serverId: string,
    @Body() dto: SetProjectServerAccessDto,
    @Req() req: RequestWithUser,
  ) {
    return this.projectsService.grantAccess({
      projectId,
      serverId,
      operations: dto.operations,
      changedBy: this.resolveActor(req),
    });
  }

  @Delete(':projectId/servers/:serverId')
  @ApiOperation({ summary: 'Revoke project access to a server' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiOkResponse({ description: 'Access mapping revoked.' })
  @ApiNotFoundResponse({ description: 'Access mapping not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  revokeProjectServerAccess(
    @Param('projectId') projectId: string,
    @Param('serverId') serverId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.projectsService.revokeAccess({
      projectId,
      serverId,
      changedBy: this.resolveActor(req),
    });
  }

  @Get(':projectId/servers')
  @ApiOperation({ summary: 'List servers accessible by a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiOkResponse({ description: 'Server mappings retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  listServersByProject(@Param('projectId') projectId: string) {
    return this.projectsService.listServersByProject(projectId);
  }

  @Get('servers/:serverId/projects')
  @ApiOperation({ summary: 'List projects that can access a server' })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiOkResponse({ description: 'Project mappings retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  listProjectsByServer(@Param('serverId') serverId: string) {
    return this.projectsService.listProjectsByServer(serverId);
  }

  @Get('access/matrix')
  @ApiOperation({ summary: 'List full project-server access matrix' })
  @ApiOkResponse({ description: 'Access matrix retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  listAccessMatrix() {
    return this.projectsService.listAccessMatrix();
  }

  @Get('access/audit')
  @ApiOperation({ summary: 'List access change audit logs' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max entries to return (1–500, default 100)',
    example: 100,
  })
  @ApiOkResponse({ description: 'Audit logs retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  listAccessAudit(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const safeLimit = Math.min(
      Math.max(limit ?? ProjectsController.DEFAULT_AUDIT_LIMIT, 1),
      500,
    );
    return this.projectsService.listAudit(safeLimit);
  }
}
