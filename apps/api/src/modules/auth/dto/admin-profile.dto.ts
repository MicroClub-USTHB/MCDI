import type { AdminProfile } from '@mcdi/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateAdminProfileDto {
  @ApiPropertyOptional({
    description:
      'Local display-name override (1–255 chars). Send null to clear it and ' +
      'fall back to the Discord-synced name. Omit the key to leave it unchanged.',
    nullable: true,
    minLength: 1,
    maxLength: 255,
    example: 'J. Doe',
  })
  // IsOptional also lets an explicit null through, which means "clear".
  @IsOptional()
  @IsString()
  @Length(1, 255)
  preferredName?: string | null;
}

export class AdminProfileResponseDto implements AdminProfile {
  @ApiProperty({ example: '123456789012345678' })
  id!: string;

  @ApiProperty({ example: 'johndoe' })
  username!: string;

  @ApiProperty({ nullable: true, example: 'John Doe' })
  globalName!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Discord guild nickname, rewritten on every sync',
    example: 'John',
  })
  displayName!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Admin-set override; takes precedence in the UI when present',
    example: 'J. Doe',
  })
  preferredName!: string | null;

  @ApiProperty({ nullable: true })
  avatar!: string | null;

  @ApiProperty({ nullable: true, example: 'johndoe@example.com' })
  email!: string | null;

  @ApiProperty({ example: true })
  isSystemAdmin!: boolean;
}
