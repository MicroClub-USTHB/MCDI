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
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
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
@UseGuards(SystemAdminGuard)
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
  async getMemberServers(
    @Param('discordId') discordId: string,
  ): Promise<MemberCrossServerViewDto> {
    return this.adminMembersService.getMemberCrossServerView(discordId);
  }

  @Get('cross-server')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'List members across servers (paginated)',
    description:
      'Paginated list of members across all managed servers. Use filter=club for members in the main server only, or filter=all for any managed server.',
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
      'Exports the cross-server member report as a downloadable CSV or JSON file.',
  })
  @ApiOkResponse({ description: 'File download (CSV or JSON).' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  async exportMembers(
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const rows = await this.adminMembersService.getExportData(query.filter);

    if (query.format === 'csv') {
      const csv = this.toCsv(rows);
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

  // ────────────── helpers ──────────────

  private toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const escape = (val: unknown): string => {
      const str =
        val == null
          ? ''
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val as string | number | boolean);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(',')),
    ];
    return lines.join('\n');
  }
}
