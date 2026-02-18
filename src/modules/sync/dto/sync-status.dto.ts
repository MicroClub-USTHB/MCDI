import { ApiProperty } from '@nestjs/swagger';

export class SyncStatusDto {
  @ApiProperty({ example: '123456789012345678' })
  serverId: string;

  @ApiProperty({ example: '2025-03-15T10:30:00.000Z' })
  lastSyncAt: string | null;

  @ApiProperty({
    example: 'success',
    enum: ['success', 'failed', 'in_progress'],
  })
  status: string;

  @ApiProperty({ example: 1250 })
  membersSynced: number;

  @ApiProperty({ example: 42 })
  rolesSynced: number;

  @ApiProperty({ example: 'Sync completed successfully', required: false })
  message?: string;

  @ApiProperty({ example: '2025-03-15T10:30:00.000Z' })
  startedAt: string;

  @ApiProperty({ example: '2025-03-15T10:32:00.000Z', required: false })
  finishedAt?: string;
}
