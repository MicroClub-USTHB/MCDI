import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Checks a schema (steps or flat fields) without creating anything. `schema` is what create
 * takes; the rest only shapes the generated docs, so the preview shows what
 * the project's developers will actually receive.
 */
export class PreviewInboundWebhookSchemaDto {
  @ApiProperty({
    description:
      'Either `steps` or flat `fields`, not both; checked by the same validator that create uses.',
    example: {
      version: 1,
      steps: [
        {
          key: 'identity',
          fields: [{ key: 'firstname', type: 'string', required: true }],
        },
      ],
    },
  })
  @IsObject()
  schema!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Shown as the title of the generated docs.',
    example: 'Recruitment 2026',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether the docs describe request signing.',
  })
  @IsOptional()
  @IsBoolean()
  requireSignature?: boolean;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether the docs say unknown fields are rejected.',
  })
  @IsOptional()
  @IsBoolean()
  rejectUnknownFields?: boolean;

  @ApiPropertyOptional({
    description: 'Origins the docs list as permitted. Empty = any origin.',
    example: ['https://app.microclub.dz'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedOrigins?: string[];
}
