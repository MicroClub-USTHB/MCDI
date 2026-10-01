import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const PERIODS = ['7d', '30d', '90d'] as const;

export class QueryUsageDto {
  @ApiPropertyOptional({
    description: 'Time period for stats',
    enum: PERIODS,
    default: '30d',
  })
  @IsOptional()
  @IsIn(PERIODS)
  period: string = '30d';

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  projectId?: string;
}
