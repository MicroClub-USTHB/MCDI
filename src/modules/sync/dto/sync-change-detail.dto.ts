import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncChangeDetailDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 42 })
  syncLogId: number;

  @ApiProperty({ example: '123456789012345678' })
  serverId: string;

  @ApiProperty({
    enum: ['member', 'role', 'server'],
    example: 'member',
  })
  entityType: string;

  @ApiProperty({ example: '987654321098765432' })
  entityId: string;

  @ApiProperty({
    enum: [
      'added',
      'removed',
      'updated',
      'deactivated',
      'role_assigned',
      'role_removed',
    ],
    example: 'added',
  })
  action: string;

  @ApiPropertyOptional({ example: 'Member JohnDoe joined the server' })
  description?: string;

  @ApiPropertyOptional({
    example: '{"nickname":"OldNick","newNickname":"NewNick"}',
  })
  details?: string;

  @ApiProperty({ example: '2025-03-15T10:30:00.000Z' })
  createdAt: string;
}

export class SyncChangeDetailsResponseDto {
  @ApiProperty({ type: [SyncChangeDetailDto] })
  changes: SyncChangeDetailDto[];

  @ApiProperty({ example: 250 })
  total: number;
}

export class SyncChangeDetailsQueryDto {
  @ApiProperty({ description: 'Sync log ID', example: 42 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  syncLogId: number;

  @ApiPropertyOptional({
    default: 100,
    description: 'Max results to return (1-500)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ default: 0, description: 'Number of records to skip' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
