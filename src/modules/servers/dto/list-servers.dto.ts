import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListServersDto {
  @ApiPropertyOptional({
    description: 'Filter by active/inactive status.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by main server status.',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isMain?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by server type (e.g. official, partner, other).',
    example: 'official',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter by server name (case-insensitive partial match).',
    example: 'MicroClub',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;
}
