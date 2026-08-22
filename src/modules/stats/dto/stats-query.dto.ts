import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

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
  @ApiPropertyOptional({
    description:
      'Server to analyse. If omitted, returns cross-server role distribution merged by role name.',
  })
  @IsOptional()
  @IsString()
  serverId?: string;
}
