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
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { RequirePermission } from '../../common/decorators/admin-access.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, ProjectScope } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateRedirectUriDto } from './dto/update-redirect-uri.dto';
import { SetProjectServerAccessDto } from './dto/set-project-server-access.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { ListProjectServersDto } from './dto/list-project-servers.dto';
import { ListProjectsByServerDto } from './dto/list-projects-by-server.dto';
import { ListAccessMatrixDto } from './dto/list-access-matrix.dto';
import { AuditAction, ListAuditDto } from './dto/list-audit.dto';

type RequestWithUser = Request & {
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
};

@ApiTags('Projects')
@ApiBearerAuth('session-token')
@Controller('admin/projects')
@UseGuards(AdminAccessGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ProjectsController {
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
  @RequirePermission('projects', 'write')
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
  @RequirePermission('projects', 'read')
  @ApiOperation({ summary: 'List all projects' })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active/inactive status.',
    example: true,
  })
  @ApiQuery({
    name: 'isInternal',
    required: false,
    type: Boolean,
    description: 'Filter by internal/external project type.',
    example: false,
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filter by project name (case-insensitive partial match).',
    example: 'MicroClub',
  })
  @ApiOkResponse({ description: 'Projects retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid parameter.' })
  findAll(@Query() query: ListProjectsDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('projects', 'read')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiOkResponse({ description: 'Project retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid project ID format.' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('projects', 'write')
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiOkResponse({ description: 'Project updated successfully.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid project ID or request body.' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Get(':id/api-key')
  @RequirePermission('project_keys', 'read')
  @ApiOperation({
    summary: 'Reveal project API key info',
    description:
      'Returns the API key prefix and metadata. The full secret cannot be recovered — ' +
      'use POST :id/regenerate-api-key to generate a new one.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiOkResponse({
    description: 'API key info retrieved.',
    schema: {
      example: {
        projectId: 'uuid',
        projectName: 'MicroClub Website',
        apiKeyPrefix: 'mcdi_pk_live_ab12cd34',
        apiKeyCreatedAt: '2026-02-20T00:00:00.000Z',
        apiKeyLastUsedAt: '2026-03-01T12:00:00.000Z',
        isActive: true,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid project ID format.' })
  getApiKeyInfo(@Param('id') id: string) {
    return this.projectsService.getApiKeyInfo(id);
  }

  @Delete(':id/key')
  @RequirePermission('project_keys', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke API key' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiNoContentResponse({ description: 'API key revoked.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid project ID format.' })
  revokeKey(@Param('id') id: string) {
    return this.projectsService.revokeKey(id);
  }

  @Post(':id/restore-key')
  @RequirePermission('project_keys', 'write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore a revoked API key' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiNoContentResponse({ description: 'API key restored.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid project ID format.' })
  restoreKey(@Param('id') id: string) {
    return this.projectsService.restoreKey(id);
  }

  @Delete(':id')
  @RequirePermission('projects', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiNoContentResponse({ description: 'Project deleted.' })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid project ID format.' })
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }

  // ── Admin-only operations ────────────────────────────────────────────

  @Post(':id/regenerate-api-key')
  @RequirePermission('project_keys', 'write')
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
  @ApiBadRequestResponse({ description: 'Invalid project ID format.' })
  regenerateApiKeyAdmin(@Param('id') id: string) {
    return this.projectsService.regenerateApiKeyAdmin(id);
  }

  @Patch(':id/redirect-uri')
  @RequirePermission('projects', 'write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update allowed redirect URI(s)',
    description:
      'Sets the redirect URI(s) allowed for this project. ' +
      'Accepts a single URI or a comma-separated list. ' +
      'The value passed to GET /auth/authorize must exactly match one of these.',
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
  @ApiBadRequestResponse({ description: 'Invalid project ID or redirect URI.' })
  updateRedirectUri(
    @Param('id') id: string,
    @Body() dto: UpdateRedirectUriDto,
  ) {
    return this.projectsService.updateRedirectUri(id, dto);
  }

  // ─── Project-Server Access ─────────────────────────────────────────

  @Put(':projectId/servers/:serverId')
  @RequirePermission('projects', 'write')
  @ApiOperation({
    summary: 'Grant or update project access to a server',
    description:
      'Creates or updates the access mapping between a project and a server. ' +
      'You can set both the allowed operations and the scopes per server. ' +
      'If scopes are omitted, existing scopes are preserved (or all scopes are granted for new mappings).',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiBody({ type: SetProjectServerAccessDto })
  @ApiOkResponse({
    description: 'Access mapping upserted.',
    schema: {
      example: {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        serverId: '123456789012345678',
        operations: {
          READ: true,
          SEND_MESSAGES: false,
          MANAGE_WEBHOOKS: false,
        },
        scopes: ['read_members', 'check_permissions'],
        createdAt: '2026-02-20T00:00:00.000Z',
        updatedAt: '2026-03-09T12:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Project or server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({
    description: 'Invalid project or server ID format.',
  })
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
      scopes: dto.scopes,
      changedBy: this.resolveActor(req),
    });
  }

  @Delete(':projectId/servers/:serverId')
  @RequirePermission('projects', 'manage')
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
  @ApiBadRequestResponse({
    description: 'Invalid project or server ID format.',
  })
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
  @RequirePermission('projects', 'read')
  @ApiOperation({ summary: 'List servers accessible by a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiOkResponse({
    description: 'Server mappings retrieved successfully.',
    schema: {
      example: [
        {
          projectId: '123e4567-e89b-12d3-a456-426614174000',
          serverId: '123456789012345678',
          serverName: 'MicroClub Main',
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
          scopes: ['read_members', 'check_permissions'],
          updatedAt: '2026-03-09T12:00:00.000Z',
        },
      ],
    },
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ProjectScope,
    description: 'Filter servers by required scope.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid project ID format.' })
  listServersByProject(
    @Param('projectId') projectId: string,
    @Query() query: ListProjectServersDto,
  ) {
    return this.projectsService.listServersByProject(projectId, query);
  }

  @Get('servers/:serverId/projects')
  @RequirePermission('projects', 'read')
  @ApiOperation({ summary: 'List projects that can access a server' })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiOkResponse({ description: 'Project mappings retrieved successfully.' })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ProjectScope,
    description: 'Filter projects by required scope.',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by project active status.',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid server ID format.' })
  listProjectsByServer(
    @Param('serverId') serverId: string,
    @Query() query: ListProjectsByServerDto,
  ) {
    return this.projectsService.listProjectsByServer(serverId, query);
  }

  @Get('access/matrix')
  @RequirePermission('projects', 'read')
  @ApiOperation({
    summary: 'List full project-server access matrix',
    description:
      'Returns every project-server mapping including operations and per-server scopes.',
  })
  @ApiOkResponse({
    description: 'Access matrix retrieved successfully.',
    schema: {
      example: [
        {
          projectId: '123e4567-e89b-12d3-a456-426614174000',
          projectName: 'MicroClub Website',
          serverId: '123456789012345678',
          serverName: 'MicroClub Main',
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
          scopes: ['read_members', 'check_permissions'],
          updatedAt: '2026-03-09T12:00:00.000Z',
        },
      ],
    },
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'Filter by project ID.',
  })
  @ApiQuery({
    name: 'serverId',
    required: false,
    type: String,
    description: 'Filter by server ID.',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    enum: ProjectScope,
    description: 'Filter by scope.',
  })
  @ApiQuery({
    name: 'projectName',
    required: false,
    type: String,
    description: 'Filter by project name (partial, case-insensitive).',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid parameter.' })
  listAccessMatrix(@Query() query: ListAccessMatrixDto) {
    return this.projectsService.listAccessMatrix(query);
  }

  @Get('access/audit')
  @RequirePermission('projects', 'read')
  @ApiOperation({ summary: 'List access change audit logs' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max entries to return (1–500, default 100).',
    example: 100,
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: String,
    description: 'Filter by project ID.',
  })
  @ApiQuery({
    name: 'serverId',
    required: false,
    type: String,
    description: 'Filter by server ID.',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: AuditAction,
    description: 'Filter by audit action type.',
  })
  @ApiOkResponse({ description: 'Audit logs retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid limit parameter.' })
  listAccessAudit(@Query() query: ListAuditDto) {
    return this.projectsService.listAudit({
      limit: query.limit,
      projectId: query.projectId,
      serverId: query.serverId,
      action: query.action,
    });
  }
}
