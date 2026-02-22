import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SystemAdminGuard } from '../auth/guards/system-admin.guard';
import { ProjectsAccessService } from './projects-access.service';
import { SetProjectServerAccessDto } from './dto/set-project-server-access.dto';

type RequestWithUser = Request & {
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };
};

@ApiTags('Project Access')
@UseGuards(SystemAdminGuard)
@Controller('projects/access')
export class ProjectsAccessController {
  private static readonly DEFAULT_AUDIT_LIMIT = 100;

  constructor(private readonly accessService: ProjectsAccessService) {}

  private resolveActor(req: RequestWithUser): string {
    return (
      req.user?.id ??
      req.user?.email ??
      req.user?.username ??
      (process.env.NODE_ENV === 'development' ? 'dev-admin' : 'unknown-admin')
    );
  }

  @Put()
  @ApiOperation({ summary: 'Grant or update project access to a server' })
  @ApiBody({ type: SetProjectServerAccessDto })
  @ApiOkResponse({ description: 'Access mapping upserted.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  setProjectServerAccess(
    @Body() dto: SetProjectServerAccessDto,
    @Req() req: RequestWithUser,
  ) {
    return this.accessService.grantAccess({
      projectId: dto.projectId,
      serverId: dto.serverId,
      operations: dto.operations,
      changedBy: this.resolveActor(req),
    });
  }

  @Delete(':projectId/servers/:serverId')
  @ApiOperation({ summary: 'Revoke project access to a server' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiParam({ name: 'serverId', example: '123456789012345678' })
  @ApiOkResponse({ description: 'Access mapping revoked.' })
  revokeProjectServerAccess(
    @Param('projectId') projectId: string,
    @Param('serverId') serverId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.accessService.revokeAccess({
      projectId,
      serverId,
      changedBy: this.resolveActor(req),
    });
  }

  @Get('matrix')
  @ApiOperation({ summary: 'List full project-server access matrix' })
  @ApiOkResponse({ description: 'Access matrix returned.' })
  listAccessMatrix() {
    return this.accessService.listAccessMatrix();
  }

  @Get('projects/:projectId/servers')
  @ApiOperation({ summary: 'List servers accessible by a project' })
  @ApiParam({ name: 'projectId', format: 'uuid' })
  @ApiOkResponse({ description: 'Project server mappings returned.' })
  listServersByProject(@Param('projectId') projectId: string) {
    return this.accessService.listServersByProject(projectId);
  }

  @Get('servers/:serverId/projects')
  @ApiOperation({ summary: 'List projects that can access a server' })
  @ApiParam({ name: 'serverId', example: '123456789012345678' })
  @ApiOkResponse({ description: 'Server project mappings returned.' })
  listProjectsByServer(@Param('serverId') serverId: string) {
    return this.accessService.listProjectsByServer(serverId);
  }

  @Get('audit')
  @ApiOperation({ summary: 'List access change audit logs' })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @ApiOkResponse({ description: 'Audit logs returned.' })
  listAccessAudit(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const safeLimit = Math.min(
      Math.max(limit ?? ProjectsAccessController.DEFAULT_AUDIT_LIMIT, 1),
      500,
    );
    return this.accessService.listAudit(safeLimit);
  }
}
