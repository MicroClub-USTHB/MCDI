import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListSubmissionsDto {
  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  // Converted to a Date here so an unparsable value is a 400, never an
  // Invalid Date reaching the query. A date-only value means midnight UTC.
  @ApiPropertyOptional({
    description: 'ISO 8601 timestamp — submissions received at or after it.',
    example: '2026-03-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @ApiPropertyOptional({
    description:
      'ISO 8601 timestamp — submissions received at or before it. A date-only value means midnight UTC, so it excludes that day.',
    example: '2026-04-01T00:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;
}
