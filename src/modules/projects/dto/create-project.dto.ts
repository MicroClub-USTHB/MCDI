import {
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectScope {
  READ_MEMBERS = 'read_members',
  CHECK_PERMISSIONS = 'check_permissions',
}

export class ProjectServerAccessDto {
  @ApiProperty({ example: '123456789012345678' })
  @IsString()
  serverId: string;

  @ApiPropertyOptional({
    description:
      'Scopes to grant for this server. If omitted, all available scopes are granted.',
    example: ['read_members', 'check_permissions'],
    enum: ProjectScope,
    isArray: true,
  })
  @IsArray()
  @IsEnum(ProjectScope, { each: true })
  @IsOptional()
  scopes?: ProjectScope[];
}

export class CreateProjectDto {
  @ApiProperty({ example: 'MicroClub Website' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'Main club website', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Server access configurations. If omitted, the project is automatically granted all available scopes to all servers where is_main = true.',
    type: [ProjectServerAccessDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectServerAccessDto)
  @IsOptional()
  serverAccess?: ProjectServerAccessDto[];
}
