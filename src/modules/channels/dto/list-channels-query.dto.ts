import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ChannelTypeFilter {
  TEXT = 'text',
  VOICE = 'voice',
  ANNOUNCEMENT = 'announcement',
  CATEGORY = 'category',
  ALL = 'all',
}

export class ListChannelsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by channel type',
    enum: ChannelTypeFilter,
    default: ChannelTypeFilter.ALL,
  })
  @IsOptional()
  @IsEnum(ChannelTypeFilter)
  type?: ChannelTypeFilter = ChannelTypeFilter.ALL;

  @ApiPropertyOptional({
    description: 'Filter by parent category ID',
    example: '123456789012345678',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
