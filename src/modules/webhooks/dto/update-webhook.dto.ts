import { IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWebhookDto {
  @ApiPropertyOptional({
    description: 'Webhook name (2-80 chars)',
    minLength: 2,
    maxLength: 80,
    example: 'Deploy notifications',
  })
  // An explicit null must fail IsString rather than reach Discord, so the
  // name is only skipped when the key is absent
  @ValidateIf((o: UpdateWebhookDto) => o.name !== undefined)
  @IsString()
  @Length(2, 80)
  name?: string;

  // IsOptional also lets an explicit null through, which means remove the avatar
  @ApiPropertyOptional({
    description:
      'Base64-encoded avatar image (decoded size max 256KB), or null to remove the avatar.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  avatar?: string | null;
}
