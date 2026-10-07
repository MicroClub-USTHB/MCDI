import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiNotFoundResponse,
  ApiParam,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { toCsv } from '../../common/utils/csv.util';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { RequirePermission } from '../../common/decorators/admin-access.decorator';
import { AdminMembersService } from './admin-members.service';
import {
  CrossServerQueryDto,
  ExportQueryDto,
  MemberCrossServerViewDto,
  PaginatedCrossServerListDto,
} from './dto';

@ApiTags('Members')
@ApiBearerAuth('session-token')
@Controller('admin/members')
@UseGuards(AdminAccessGuard)
@RequirePermission('members', 'read')
export class AdminMembersController {
  constructor(private readonly adminMembersService: AdminMembersService) {}

  @Get(':discordId/servers')
  @ApiOperation({
    summary: 'Get member cross-server view',
    description:
      'Returns a full cross-server view for a single member: every managed server they belong to, their roles, join date, and whether they qualify as a "club member".',
  })
  @ApiParam({
    name: 'discordId',
    description: 'Discord user ID (snowflake)',
    example: '876543210987654321',
  })
  @ApiOkResponse({
    description: 'Member cross-server view retrieved successfully.',
    type: MemberCrossServerViewDto,
  })
  @ApiNotFoundResponse({ description: 'Member not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid Discord ID format.' })
  async getMemberServers(
    @Param('discordId') discordId: string,
  ): Promise<MemberCrossServerViewDto> {
    return this.adminMembersService.getMemberCrossServerView(discordId);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary:
      'List members with optional server, role, filter and search criteria (paginated)',
    description:
      'Paginated list of members across managed servers. Supports filtering by serverId, roleId, filter=club|all, and search term.',
  })
  @ApiOkResponse({
    description: 'Paginated member list retrieved.',
    type: PaginatedCrossServerListDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  async getMemberList(
    @Query() query: CrossServerQueryDto,
  ): Promise<PaginatedCrossServerListDto> {
    return this.adminMembersService.getCrossServerList(query);
  }

  @Get('cross-server')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'List members across servers (paginated)',
    description:
      'Paginated list of members across all managed servers. Use filter=club for members in the main server only, or filter=all for any managed server. Also supports serverId, roleId, and search.',
  })
  @ApiOkResponse({
    description: 'Paginated cross-server member list retrieved.',
    type: PaginatedCrossServerListDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  async getCrossServerList(
    @Query() query: CrossServerQueryDto,
  ): Promise<PaginatedCrossServerListDto> {
    return this.adminMembersService.getCrossServerList(query);
  }

  @Get('export')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Export members report',
    description:
      'Exports the member report as a downloadable CSV or JSON file. Supports serverId, roleId, filter, and search parameters matching the list endpoint. Each exported row represents a server membership for matching members (narrowed by serverId if specified; roleId filters members holding the role across their memberships).',
  })
  @ApiOkResponse({ description: 'File download (CSV or JSON).' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  async exportMembers(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const rows = await this.adminMembersService.getExportData(query);

    if (query.format === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="members-${query.filter}-${Date.now()}.csv"`,
      );
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="members-${query.filter}-${Date.now()}.json"`,
      );
      res.json(rows);
    }
  }
}
