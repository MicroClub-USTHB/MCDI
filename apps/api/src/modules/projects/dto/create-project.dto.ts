import {
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsUrl,
  IsObject,
  Matches,
  MinLength,
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

export class ProjectInboundWebhookDto {
  @ApiProperty({ example: 'Recruitment 2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description:
      'URL-safe identifier, unique within the project. Auto-generated if omitted.',
    example: 'recruitment-2026',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, {
    message: 'slug must be lowercase alphanumeric with dashes',
  })
  slug?: string;

  @ApiProperty({ description: 'The shape of what callers send.' })
  @IsObject()
  schema: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Discord role IDs permitted to READ submissions.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{17,20}$/, {
    each: true,
    message: 'each role must be a Discord snowflake',
  })
  allowedRoleIds?: string[];

  @ApiPropertyOptional({
    description: 'Origins permitted to call this webhook. Empty = no check.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedOrigins?: string[];
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

  @ApiPropertyOptional({
    description:
      'Optional inbound webhook to provision along with the project.',
    type: ProjectInboundWebhookDto,
  })
  @ValidateNested()
  @Type(() => ProjectInboundWebhookDto)
  @IsOptional()
  inboundWebhook?: ProjectInboundWebhookDto;
}
