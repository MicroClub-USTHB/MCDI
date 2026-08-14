import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const DATE_RANGES = ['7d', '30d', '90d', '1y'] as const;
export const GRANULARITIES = ['daily', 'weekly', 'monthly'] as const;

export class MemberStatsQueryDto {
  @ApiPropertyOptional({ description: 'Filter all metrics to a single server' })
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({
    description: 'Window for new-member / growth-rate metrics',
    enum: DATE_RANGES,
    default: '30d',
  })
  @IsOptional()
  @IsIn(DATE_RANGES)
  dateRange: string = '30d';
}

export class GrowthQueryDto {
  @ApiPropertyOptional({ description: 'Filter growth to a single server' })
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({
    description: 'Time window',
    enum: DATE_RANGES,
    default: '30d',
  })
  @IsOptional()
  @IsIn(DATE_RANGES)
  period: string = '30d';

  @ApiPropertyOptional({
    description: 'Bucket size',
    enum: GRANULARITIES,
    default: 'daily',
  })
  @IsOptional()
  @IsIn(GRANULARITIES)
  granularity: string = 'daily';
}

export class RoleStatsQueryDto {
  @ApiProperty({ description: 'Server to analyse (required)' })
  @IsString()
  @IsNotEmpty()
  serverId!: string;
}

export const EXPORT_TYPES = [
  'members',
  'growth',
  'roles',
  'servers',
  'cross-server',
] as const;
export const EXPORT_FORMATS = ['csv', 'json'] as const;

export class ExportStatsQueryDto {
  @ApiProperty({
    description: 'Which statistics report to export',
    enum: EXPORT_TYPES,
  })
  @IsIn(EXPORT_TYPES)
  type!: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: EXPORT_FORMATS,
    default: 'json',
  })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format: string = 'json';

  @ApiPropertyOptional({
    description:
      'Server to scope the export to. Required when type=roles; optional filter for members/growth.',
  })
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({
    description: 'Window for members/growth exports',
    enum: DATE_RANGES,
    default: '30d',
  })
  @IsOptional()
  @IsIn(DATE_RANGES)
  dateRange: string = '30d';
}
