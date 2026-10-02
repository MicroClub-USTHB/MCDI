import {
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsUrl,
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

  @ApiPropertyOptional({ example: 'Main club website' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Whether this is an internal MicroClub platform project. ' +
      'Internal projects use the main server automatically. Defaults to false.',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the project is active. Defaults to true.',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Optional Discord webhook URL for this project.',
    example: 'https://discord.com/api/webhooks/000/token',
  })
  @IsUrl()
  @IsOptional()
  webhookUrl?: string;

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
