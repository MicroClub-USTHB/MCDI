import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SyncLogDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: '123456789012345678' })
  serverId: string;

  @ApiProperty({ enum: ['full', 'incremental', 'manual'], example: 'full' })
  syncType: string;

  @ApiProperty({
    enum: ['success', 'failed', 'in_progress'],
    example: 'success',
  })
  status: string;

  @ApiProperty({ example: 1250 })
  membersSynced: number;

  @ApiProperty({ example: 42 })
  rolesSynced: number;

  @ApiPropertyOptional({ example: 'Sync completed. 3 members marked inactive.' })
  message?: string;

  @ApiProperty({ example: '2025-03-15T10:30:00.000Z' })
  startedAt: string;

  @ApiPropertyOptional({ example: '2025-03-15T10:32:00.000Z' })
  finishedAt?: string;
}

export class SyncLogsResponseDto {
  @ApiProperty({ type: [SyncLogDto] })
  logs: SyncLogDto[];

  @ApiProperty({ example: 100 })
  total: number;
}
