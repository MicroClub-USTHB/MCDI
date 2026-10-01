import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProjectScope } from './create-project.dto';

export class ListAccessMatrixDto {
  @ApiPropertyOptional({
    description: 'Filter by project ID.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filter by server ID.',
    example: '123456789012345678',
  })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiPropertyOptional({
    description: 'Filter to only mappings that include this scope.',
    enum: ProjectScope,
    example: 'read_members',
  })
  @IsEnum(ProjectScope)
  @IsOptional()
  scope?: ProjectScope;

  @ApiPropertyOptional({
    description: 'Filter by project name (case-insensitive partial match).',
    example: 'MicroClub',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  projectName?: string;
}
