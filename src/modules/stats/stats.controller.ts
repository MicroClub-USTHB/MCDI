import {
  Controller,
  Get,
  Query,
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
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { StatsService } from './stats.service';
import {
  DATE_RANGES,
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
      'NOTE: member departures are not tracked yet, so `leftMembers` is always 0. ' +
      'Results are cached for 5 minutes.',
  })
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
      'Per-server member/active/role counts and latest sync status. ' +
      'Results are cached for 5 minutes.',
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
}
