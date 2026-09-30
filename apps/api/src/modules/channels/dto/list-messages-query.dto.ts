import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'Max number of messages to return (1–100)',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Get messages before this Discord snowflake ID',
    example: '123456789012345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/, {
    message: 'before must be a valid Discord snowflake ID',
  })
  before?: string;

  @ApiPropertyOptional({
    description: 'Get messages after this Discord snowflake ID',
    example: '123456789012345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/, {
    message: 'after must be a valid Discord snowflake ID',
  })
  after?: string;

  @ApiPropertyOptional({
    description: 'Filter by author Discord ID',
    example: '123456789012345678',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/, {
    message: 'authorId must be a valid Discord snowflake ID',
  })
  authorId?: string;
}
