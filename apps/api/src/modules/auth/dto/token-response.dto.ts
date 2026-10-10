import { ApiProperty } from '@nestjs/swagger';
import { AuthMemberResponseDto } from './response.dto';

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
    description:
      'Refresh token used to rotate this session via POST /auth/token/refresh',
    example: 'r1e2f3r4e5s6h7t8o9k0e1n2...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Basic profile information for the authenticated member',
    type: AuthMemberResponseDto,
  })
  member: AuthMemberResponseDto;

  @ApiProperty({
    description: 'List of roles the member has in the associated server',
    type: [AuthMemberRoleDto],
  })
  roles: AuthMemberRoleDto[];
}
