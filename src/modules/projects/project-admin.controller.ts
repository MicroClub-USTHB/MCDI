import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { ProjectsService } from './projects.service';
import { UpdateRedirectUriDto } from './dto/update-redirect-uri.dto';

@ApiTags('Admin Projects')
@ApiBearerAuth('session-token')
@Controller('admin/projects')
@UseGuards(SystemAdminGuard)
export class ProjectAdminController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post(':id/regenerate-api-key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Regenerate project API key',
    description:
      'Generates a new API key for a project. The old key will be immediately invalidated. ' +
      'This is useful for security purposes or if a key has been compromised.',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'API key regenerated successfully',
    schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
        },
        apiKey: { type: 'string', example: 'mcdi-proj-abc123def456' },
        apiKeyCreatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized – invalid or missing admin credentials',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async regenerateApiKey(@Param('id') projectId: string) {
    return this.projectsService.regenerateApiKeyAdmin(projectId);
  }

  @Patch(':id/redirect-uri')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update allowed redirect URI(s)',
    description:
      'Sets the redirect URI(s) allowed for this project. ' +
      'Accepts a single URI or a comma-separated list for multiple allowed URIs. ' +
      'The value you pass in POST /auth/login-session must exactly match one of these.',
  })
  @ApiParam({
    name: 'id',
    description: 'Project ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateRedirectUriDto })
  @ApiResponse({
    status: 200,
    description: 'Redirect URI updated',
    schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        redirectUri: { type: 'string', example: 'https://events.microclub.net/auth/callback' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async updateRedirectUri(
    @Param('id') projectId: string,
    @Body() dto: UpdateRedirectUriDto,
  ) {
    return this.projectsService.updateRedirectUri(projectId, dto);
  }
}
