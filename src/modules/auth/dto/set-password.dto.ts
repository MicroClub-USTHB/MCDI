import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiPropertyOptional({
    description:
      'Current password — required when the admin already has a password configured. ' +
      'Omit only on first-time password setup.',
    example: 'oldPassword123',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({
    description: 'New password. Must be at least 8 characters.',
    example: 'newSecurePass!9',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

export class AdminMeResponseDto {
  @ApiProperty({
    description: 'Member ID (Discord snowflake)',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({
    description: 'Discord username',
    example: 'johndoe',
  })
  username: string;

  @ApiPropertyOptional({
    description: 'Discord global display name',
    example: 'John Doe',
    nullable: true,
  })
  globalName: string | null;

  @ApiPropertyOptional({
    description: 'Server-level display name override',
    example: 'J. Doe',
    nullable: true,
  })
  displayName: string | null;

  @ApiPropertyOptional({
    description: 'Discord avatar hash or full CDN URL',
    example: 'https://cdn.discordapp.com/avatars/123456789012345678/abc123.png',
    nullable: true,
  })
  avatar: string | null;

  @ApiPropertyOptional({
    description: 'Email address from Discord (requires email OAuth scope)',
    example: 'johndoe@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Whether the member has the system admin flag set',
    example: true,
  })
  isSystemAdmin: boolean;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the current session expires',
    example: '2026-03-13T05:00:00.000Z',
  })
  sessionExpiresAt: Date;
}
