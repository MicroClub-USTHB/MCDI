import {
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectScope {
  READ_MEMBERS = 'read_members',
  CHECK_PERMISSIONS = 'check_permissions',
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
      'Discord server IDs the project should have access to. ' +
      'If omitted or empty, the project is automatically granted access to all servers where is_main = true.',
    example: ['123456789012345678', '987654321098765432'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  serverIds?: string[];

  @ApiPropertyOptional({
    description:
      'Scopes to grant for each linked server. ' +
      'If omitted, all available scopes are granted by default.',
    example: ['read_members', 'check_permissions'],
    enum: ProjectScope,
    isArray: true,
  })
  @IsArray()
  @IsEnum(ProjectScope, { each: true })
  @IsOptional()
  scopes?: ProjectScope[];
}
