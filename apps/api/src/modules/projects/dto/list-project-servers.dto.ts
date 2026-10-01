import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProjectScope } from './create-project.dto';

export class ListProjectServersDto {
  @ApiPropertyOptional({
    description: 'Filter to only server mappings that include this scope.',
    enum: ProjectScope,
    example: 'read_members',
  })
  @IsEnum(ProjectScope)
  @IsOptional()
  scope?: ProjectScope;
}
