import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { StatsService } from './stats.service';
import {
  DATE_RANGES,
  EXPORT_FORMATS,
  EXPORT_TYPES,
  ExportStatsQueryDto,
  GRANULARITIES,
  GrowthQueryDto,
  MemberStatsQueryDto,
  RoleStatsQueryDto,
} from './dto/stats-query.dto';

@ApiTags('Statistics')
@ApiBearerAuth('session-token')
@Controller('admin/stats')
@UseGuards(SystemAdminGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('members')
  @ApiOperation({
    summary: 'Aggregate member statistics',
    description:
      'Aggregate counts only, never individual member data. ' +
      '`activeMembers` counts members with an active membership in at least one server. ' +
      '`growthRate` = newMembersThisPeriod / (totalMembers - newMembersThisPeriod) * 100. ' +
      'Results are cached for 5 minutes.',
  })
  @ApiQuery({ name: 'serverId', required: false })
  @ApiQuery({ name: 'dateRange', required: false, enum: DATE_RANGES })
  @ApiOkResponse({
    description: 'Member statistics.',
    schema: {
      example: {
        totalMembers: 1200,
        clubMembers: 800,
        nonClubMembers: 400,
        activeMembers: 1100,
        inactiveMembers: 100,
        newMembersThisPeriod: 45,
        growthRate: 3.9,
        byRole: [{ roleName: 'Member', count: 800, percentage: 66.67 }],
        byServer: [{ serverId: '123', serverName: 'Main', memberCount: 1200 }],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  getMemberStats(@Query() dto: MemberStatsQueryDto) {
    return this.statsService.getMemberStats(dto);
  }

  @Get('members/growth')
  @ApiOperation({
    summary: 'Member growth over time',
    description:
      'New members are bucketed by `createdAt` (when the record entered the system); ' +
      '`count` is the cumulative member total at each bucket. ' +
      '`trend` compares the second half of the series against the first half. ' +
      'NOTE: member departures are not tracked yet, so `leftMembers` is always 0. ' +
      'Results are cached for 5 minutes.',
  })
  @ApiQuery({ name: 'serverId', required: false })
  @ApiQuery({ name: 'period', required: false, enum: DATE_RANGES })
  @ApiQuery({ name: 'granularity', required: false, enum: GRANULARITIES })
  @ApiOkResponse({
    description: 'Growth series.',
    schema: {
      example: {
        data: [
          {
            date: '2026-06-01T00:00:00.000Z',
            count: 1180,
            newMembers: 12,
            leftMembers: 0,
          },
        ],
        period: '30d',
        totalGrowth: 45,
        trend: 'increase',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters.' })
  getMemberGrowth(@Query() dto: GrowthQueryDto) {
    return this.statsService.getMemberGrowth(dto);
  }

  @Get('roles')
  @ApiOperation({
    summary: 'Role distribution for a server',
    description:
      'Member count per role for the given server, ordered by role position. ' +
      'Results are cached for 5 minutes.',
  })
  @ApiQuery({ name: 'serverId', required: true })
  @ApiOkResponse({
    description: 'Role distribution.',
    schema: {
      example: {
        serverId: '123',
        serverName: 'Main',
        roles: [
          {
            roleId: '456',
            roleName: 'Member',
            memberCount: 800,
            hierarchyLevel: 1,
            color: 3447003,
          },
        ],
        totalMembers: 1200,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'serverId is required.' })
  getRoleStats(@Query() dto: RoleStatsQueryDto) {
    return this.statsService.getRoleStats(dto);
  }

  @Get('servers')
  @ApiOperation({
    summary: 'Server-level statistics',
    description:
      'Per-server member/active/role counts, sync status, and bot health. ' +
      '`lastSync` is the last *successful* sync (may lag behind `syncStatus` ' +
      'if the most recent attempt failed); `lastSyncError` is populated only ' +
      'when the most recent attempt failed. `botStatus` reflects live bot ' +
      'connectivity at computation time. ' +
      'Results are cached for 5 minutes, satisfying the near-real-time (≤5 min) health requirement.',
  })
  @ApiOkResponse({
    description: 'Server statistics.',
    schema: {
      example: {
        servers: [
          {
            serverId: '123',
            serverName: 'Main',
            memberCount: 1200,
            activeMembers: 1100,
            roleCount: 15,
            lastSync: '2026-06-22T10:00:00.000Z',
            syncStatus: 'success',
            lastSyncError: null,
            botStatus: 'online',
          },
        ],
        totalServers: 1,
        totalMembers: 1200,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  getServerStats() {
    return this.statsService.getServerStats();
  }

  @Get('cross-server')
  @ApiOperation({
    summary: 'Cross-server member overlap',
    description:
      'Members present in more than one managed server, plus pairwise ' +
      'overlap counts between every pair of servers. Results are cached for 5 minutes.',
  })
  @ApiOkResponse({
    description: 'Cross-server overlap statistics.',
    schema: {
      example: {
        membersInMultipleServers: 42,
        overlaps: [
          {
            serverAId: '111',
            serverAName: 'Main',
            serverBId: '222',
            serverBName: 'Study Group',
            overlapCount: 18,
          },
        ],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  getCrossServerStats() {
    return this.statsService.getCrossServerStats();
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export a statistics report as CSV or JSON',
    description:
      'Exports the same data as the corresponding read endpoint ' +
      '(members, growth, roles, servers, cross-server) as a file download. ' +
      '`serverId` is required when type=roles.',
  })
  @ApiQuery({ name: 'type', required: true, enum: EXPORT_TYPES })
  @ApiQuery({ name: 'format', required: false, enum: EXPORT_FORMATS })
  @ApiQuery({ name: 'serverId', required: false })
  @ApiQuery({ name: 'dateRange', required: false, enum: DATE_RANGES })
  @ApiOkResponse({ description: 'File download (CSV or JSON).' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({
    description:
      'Invalid query parameters, or missing serverId for type=roles.',
  })
  async exportStats(
    @Query() dto: ExportStatsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const { content, contentType, filename } =
      await this.statsService.exportStats(dto);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }
}
