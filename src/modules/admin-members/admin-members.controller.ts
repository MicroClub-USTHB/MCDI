import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { AdminMembersService } from './admin-members.service';
import type {
  MemberCrossServerViewDto,
  PaginatedCrossServerListDto,
} from './dto';

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
  async getCrossServerList(
    @Query('filter') filter: string = 'all',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ): Promise<PaginatedCrossServerListDto> {
    const validFilter = filter === 'club' ? 'club' : 'all';
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    return this.adminMembersService.getCrossServerList({
      filter: validFilter,
      page: pageNum,
      limit: limitNum,
      search: search || undefined,
    });
  }

  /**
   * GET /admin/members/export?filter=club|all&format=csv|json
   *
   * Exports the cross-server member report as CSV or JSON.
   */
  @Get('export')
  async exportMembers(
    @Query('filter') filter: string = 'all',
    @Query('format') format: string = 'json',
    @Res() res: Response,
  ): Promise<void> {
    const validFilter = filter === 'club' ? 'club' : 'all';
    const rows = await this.adminMembersService.getExportData(validFilter);

    if (format === 'csv') {
      const csv = this.toCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="members-${validFilter}-${Date.now()}.csv"`,
      );
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="members-${validFilter}-${Date.now()}.json"`,
      );
      res.json(rows);
    }
  }

  // ────────────── helpers ──────────────

  private toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0]);
    const escape = (val: unknown): string => {
      const str = String(val ?? '');
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
