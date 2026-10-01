import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListWebhooksQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by Discord server ID',
    example: '123456789012345678',
  })
  @IsOptional()
  @IsString()
  serverId?: string;

  @ApiPropertyOptional({
    description: 'Max number of webhooks (1-100)',
    default: 50,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Pagination offset',
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
