import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SyncLogsQueryDto {
  @ApiProperty({
    description: 'Discord server (guild) ID',
    example: '123456789012345678',
  })
  @IsString()
  serverId: string;

  @ApiPropertyOptional({
    default: 20,
    description: 'Max results to return (1-100)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ default: 0, description: 'Number of records to skip' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number;
}
