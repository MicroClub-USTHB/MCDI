import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsArray, ValidateIf } from 'class-validator';

export enum SyncTarget {
  ALL = 'all',
  MEMBERS = 'members',
  ROLES = 'roles',
}

export class TriggerSyncDto {
  @ApiPropertyOptional({
    description: 'Array of Discord server (guild) IDs to sync. Leave empty or omit to sync ALL active servers.',
    example: ['123456789012345678', '876543210987654321'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serverIds?: string[];

  @ApiPropertyOptional({
    description: 'What entities to sync',
    enum: SyncTarget,
    default: SyncTarget.ALL,
  })
  @IsOptional()
  @IsEnum(SyncTarget)
  target?: SyncTarget;
}
