import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInboundWebhookDto {
  @ApiProperty({ description: 'The project this webhook belongs to.' })
  @IsString()
  projectId!: string;

  @ApiProperty({ example: 'Recruitment 2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'URL-safe identifier, unique within the project.',
    example: 'recruitment-2026',
  })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/, {
    message: 'slug must be lowercase alphanumeric with dashes',
  })
  slug!: string;

  @ApiProperty({
    description: 'A FormSchema. Validated by the Layer-1 schema validator.',
    example: {
      version: 1,
      steps: [
        {
          key: 'identity',
          fields: [
            { key: 'firstname', type: 'string', required: true, maxLength: 80 },
            { key: 'name', type: 'string', required: true, maxLength: 80 },
          ],
        },
      ],
    },
  })
  @IsObject()
  schema!: Record<string, unknown>;

  /**
   * Required and non-empty by design. Unlike project_roles — where no entries
   * means "anyone authenticated" — an inbound webhook with no roles would
   * expose submissions to every logged-in member. Fail closed.
   */
  @ApiProperty({
    description:
      'Discord role IDs permitted to READ submissions. At least one is required.',
    example: ['1234567890123456789'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'at least one allowed role is required' })
  @IsString({ each: true })
  @Matches(/^\d{17,20}$/, {
    each: true,
    message: 'each role must be a Discord snowflake',
  })
  allowedRoleIds!: string[];

  @ApiPropertyOptional({
    description: 'Origins permitted to call this webhook. Empty = no check.',
    example: ['https://app.microclub.dz'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedOrigins?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  requireSignature?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  rejectUnknownFields?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Whether role inheritance rules grant read access. Off by default: data access should be explicit.',
  })
  @IsOptional()
  @IsBoolean()
  allowRoleInheritance?: boolean;
}
