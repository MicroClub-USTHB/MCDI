import {
  IsArray,
  IsOptional,
  IsString,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AllowedMentionsDto {
  @ApiPropertyOptional({
    description: 'Types of mentions allowed',
    example: ['users', 'roles'],
    enum: ['everyone', 'roles', 'users'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  parse?: ('everyone' | 'roles' | 'users')[];

  @ApiPropertyOptional({
    description: 'Discord user IDs to allow mentioning',
    example: ['123456789012345678'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  users?: string[];

  @ApiPropertyOptional({
    description: 'Discord role IDs to allow mentioning',
    example: ['123456789012345678'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  roles?: string[];
}
