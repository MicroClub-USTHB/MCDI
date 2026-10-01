import { IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({
    description: 'Webhook name (2-80 chars)',
    minLength: 2,
    maxLength: 80,
    example: 'Deploy notifications',
  })
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiPropertyOptional({
    description:
      'Base64-encoded avatar image, decoded size max 256KB. A base64 data URI is also accepted.',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}
