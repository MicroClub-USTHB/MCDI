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
  ApiOperation,
  ApiResponse,
  ApiParam,
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

@ApiTags('Admin Members')
@ApiBearerAuth()
@Controller('admin/members')
@UseGuards(SystemAdminGuard)
export class AdminMembersController {
  constructor(private readonly adminMembersService: AdminMembersService) {}

  /**
   * GET /admin/members/:discordId/servers
   *
   * Per-member cross-server detail: every managed server they belong to,
   * roles, join date, and club-member classification.
   */
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
  @ApiResponse({
    status: 200,
    description: 'Member cross-server view returned successfully',
    type: MemberCrossServerViewDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized – invalid or missing admin credentials',
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async getMemberServers(
    @Param('discordId') discordId: string,
  ): Promise<MemberCrossServerViewDto> {
    return this.adminMembersService.getMemberCrossServerView(discordId);
  }

  /**
   * GET /admin/members/cross-server?filter=club|all&page=1&limit=20&search=
   *
   * Paginated cross-server list for admin dashboard.
   */
  @Get('cross-server')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'List members across servers (paginated)',
    description:
      'Paginated list of members across all managed servers. Use filter=club for members in the main server only, or filter=all for any managed server.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated cross-server member list',
    type: PaginatedCrossServerListDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized – invalid or missing admin credentials',
  })
  async getCrossServerList(
    @Query() query: CrossServerQueryDto,
  ): Promise<PaginatedCrossServerListDto> {
    return this.adminMembersService.getCrossServerList(query);
  }

  /**
   * GET /admin/members/export?filter=club|all&format=csv|json
   *
   * Exports the cross-server member report as CSV or JSON.
   */
  @Get('export')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Export members report',
    description:
      'Exports the cross-server member report as a downloadable CSV or JSON file.',
  })
  @ApiResponse({ status: 200, description: 'File download (CSV or JSON)' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized – invalid or missing admin credentials',
  })
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
