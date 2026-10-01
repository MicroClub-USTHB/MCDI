import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ProjectScope } from './create-project.dto';

export class ListProjectsByServerDto {
  @ApiPropertyOptional({
    description: 'Filter to only project mappings that include this scope.',
    enum: ProjectScope,
    example: 'read_members',
  })
  @IsEnum(ProjectScope)
  @IsOptional()
  scope?: ProjectScope;

  @ApiPropertyOptional({
    description: 'Filter by project active status.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;
}
