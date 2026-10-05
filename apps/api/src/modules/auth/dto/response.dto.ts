import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { members } from '../../../database/entities';

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
    nullable: true,
  })
  globalName: string | null;

  @ApiPropertyOptional({
    description: 'Server nickname',
    example: 'John',
    nullable: true,
  })
  displayName: string | null;

  @ApiPropertyOptional({
    description: 'Name set by an admin, overriding the display name',
    example: 'Johnny',
    nullable: true,
  })
  preferredName: string | null;

  @ApiPropertyOptional({
    description: 'Avatar URL or hash',
    example: 'https://cdn.discordapp.com/avatars/123/abc.png',
    nullable: true,
  })
  avatar: string | null;

  @ApiPropertyOptional({
    description: 'Primary email associated with the Discord account',
    example: 'johndoe@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Whether the user is a club member',
    example: true,
  })
  isClubMember: boolean;

  @ApiPropertyOptional({
    description: 'Date when the member joined Discord',
    nullable: true,
  })
  joinedAt: Date | null;
}

/**
 * Picks the public fields explicitly. Never spread a member row into a
 * project-facing response: it carries `passwordHash` and `isSystemAdmin`.
 */
export function toAuthMemberResponse(
  member: typeof members.$inferSelect,
): AuthMemberResponseDto {
  return {
    id: member.id,
    username: member.username,
    globalName: member.globalName,
    displayName: member.displayName,
    preferredName: member.preferredName,
    avatar: member.avatar,
    email: member.email,
    isClubMember: member.isClubMember,
    joinedAt: member.joinedAt,
  };
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
