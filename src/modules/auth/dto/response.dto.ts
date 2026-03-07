import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Member ───────────────────────────────────────────────────

export class AuthMemberResponseDto {
  @ApiProperty({
    description: 'Member ID (Discord ID)',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Discord username', example: 'johndoe' })
  username: string;

  @ApiPropertyOptional({
    description: 'Discord global name',
    example: 'John Doe',
  })
  globalName: string | null;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  displayName: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL or hash',
    example: 'https://cdn.discordapp.com/avatars/123/abc.png',
  })
  avatar: string | null;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'johndoe@example.com',
  })
  email: string | null;

  @ApiProperty({
    description: 'Whether the user is a club member',
    example: true,
  })
  isClubMember: boolean;

  @ApiPropertyOptional({ description: 'Date when the user joined' })
  joinedAt: Date | null;

  @ApiPropertyOptional({ description: 'Last sync with Discord' })
  syncedAt: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

// ── Role ─────────────────────────────────────────────────────

export class RoleResponseDto {
  @ApiProperty({
    description: 'Discord role ID',
    example: '111222333444555666',
  })
  roleId: string;

  @ApiProperty({ description: 'Role name', example: 'Lead' })
  roleName: string;

  @ApiPropertyOptional({
    description: 'Role color (integer)',
    example: 3066993,
  })
  roleColor: number | null;

  @ApiPropertyOptional({
    description: 'Role position in the hierarchy',
    example: 5,
  })
  rolePosition: number | null;
}

// ── Validate session response ────────────────────────────────

export class ValidateSessionResponseDto {
  @ApiProperty({
    description: 'Authenticated member',
    type: AuthMemberResponseDto,
  })
  member: AuthMemberResponseDto;

  @ApiProperty({
    description: "Member's roles in the verified Discord server",
    type: [RoleResponseDto],
  })
  roles: RoleResponseDto[];
}

// ── Generic ──────────────────────────────────────────────────

export class SuccessResponseDto {
  @ApiProperty({ description: 'Operation success status', example: true })
  success: boolean;
}
