import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SyncService } from './sync.service';
import { TriggerSyncDto } from './dto/trigger-sync.dto';
import { SyncStatusDto } from './dto/sync-status.dto';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

@ApiTags('Admin Sync')
@ApiBearerAuth()
@UseGuards(SystemAdminGuard)
@Controller('admin/sync/members')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('full')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a full manual re-sync for a server' })
  @ApiResponse({
    status: 202,
    description: 'Sync started',
    schema: { example: { syncId: 42 } },
  })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Sync already in progress' })
  async triggerFullSync(
    @Body() dto: TriggerSyncDto,
  ): Promise<{ syncId: number }> {
    return this.syncService.triggerFullSync(dto.serverId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get the latest sync status for a server' })
  @ApiQuery({ name: 'serverId', required: true, type: String })
  @ApiResponse({ status: 200, type: SyncStatusDto })
  @ApiResponse({ status: 404, description: 'No sync logs found' })
  async getSyncStatus(
    @Query('serverId') serverId: string,
  ): Promise<SyncStatusDto> {
    const status = await this.syncService.getSyncStatus(serverId);
    if (!status) {
      throw new NotFoundException('No sync logs found for this server');
    }
    return status;
  }
}
