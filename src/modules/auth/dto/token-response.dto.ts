import { ApiProperty } from '@nestjs/swagger';

export class AuthMemberRoleDto {
  @ApiProperty({
    description: 'Role ID',
    example: '123456789012345678',
  })
  roleId: string;

  @ApiProperty({ description: 'Role name', example: 'Admin' })
  roleName: string;

  @ApiProperty({
    description: 'Role color in decimal',
    required: false,
    example: 16711680,
    nullable: true,
  })
  roleColor: number | null;

  @ApiProperty({
    description: 'Role position (higher = more permissions)',
    example: 1,
    required: false,
    nullable: true,
  })
  rolePosition: number | null;
}

export class AuthMemberProfileDto {
  @ApiProperty({
    description: 'Discord user ID',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Discord username', example: 'john_doe' })
  username: string;

  @ApiProperty({
    description: 'Global display name',
    required: false,
    example: 'John Doe',
    nullable: true,
  })
  globalName: string | null;

  @ApiProperty({
    description: 'Server nickname',
    required: false,
    example: 'John',
    nullable: true,
  })
  displayName: string | null;

  @ApiProperty({
    description: 'Avatar URL',
    required: false,
    example: 'https://cdn.discordapp.com/avatars/.../...png',
    nullable: true,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'Primary email associated with the Discord account',
    required: false,
    example: 'alice@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Whether the member is in the main club server',
    example: true,
  })
  isClubMember: boolean;

  @ApiProperty({
    description: 'Date the member joined Discord',
    required: false,
    example: '2025-01-15T14:30:00.000Z',
    nullable: true,
  })
  joinedAt: Date | null;
}

export class TokenResponseDto {
  @ApiProperty({
    description: 'Long-lived session token (Bearer token)',
    example: 's1e2s3s4i5o6n7t8o9k0e1n2...',
  })
  token: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the token expires',
    example: '2026-04-18T12:00:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Basic profile information for the authenticated member',
    type: AuthMemberProfileDto,
  })
  member: AuthMemberProfileDto;

  @ApiProperty({
    description: 'List of roles the member has in the associated server',
    type: [AuthMemberRoleDto],
  })
  roles: AuthMemberRoleDto[];
}
