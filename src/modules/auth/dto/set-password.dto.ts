import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
    description: 'Discord guild nickname (rewritten on every sync)',
    example: 'John',
    nullable: true,
  })
  displayName: string | null;

  @ApiPropertyOptional({
    description:
      'Admin-set display-name override (via PATCH /api/admin/profile); ' +
      'takes precedence over displayName in the UI when present',
    example: 'J. Doe',
    nullable: true,
  })
  preferredName: string | null;

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
