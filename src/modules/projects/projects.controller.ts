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
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('Admin Projects')
@ApiBearerAuth('session-token')
@Controller('admin/projects')
@UseGuards(SystemAdminGuard)
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a project',
    description:
      'Registers a new project and returns its API key. The full key is returned ONCE and never stored — save it immediately.',
  })
  @ApiResponse({
    status: 201,
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
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all projects',
    description:
      'Returns all registered projects. API key hash is never exposed.',
  })
  @ApiResponse({ status: 200, description: 'List of projects returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project returned' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a project',
    description:
      'Updates name, description, or scopes. Cannot update the API key via this endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project updated' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Post(':id/regenerate-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate API key',
    description:
      'Generates a new API key for the project. The old key is immediately invalid. New key is returned once — save it.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({
    status: 200,
    description: 'New API key generated. Old key is now invalid.',
    schema: { example: { apiKey: 'mcdi_pk_live_xy98zw76.64hexsecret...' } },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  regenerateKey(@Param('id') id: string) {
    return this.projectsService.regenerateKey(id);
  }

  @Delete(':id/key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke API key',
    description:
      'Disables the project API key. The key stops working immediately. Project data is preserved.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 204, description: 'API key revoked' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  revokeKey(@Param('id') id: string) {
    return this.projectsService.revokeKey(id);
  }

  @Post(':id/restore-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Restore a revoked API key',
    description: 'Re-enables a previously revoked project key.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 204, description: 'API key restored' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  restoreKey(@Param('id') id: string) {
    return this.projectsService.restoreKey(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a project',
    description: 'Permanently deletes the project and all its scopes.',
  })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 204, description: 'Project deleted' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }
}
