import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminPasswordLoginDto {
  @ApiProperty({
    description: 'Discord username of the system admin',
    example: 'johndoe',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Admin password (min 6 characters)',
    example: 'supersecret',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}

export class AdminLoginMemberDto {
  @ApiProperty({
    description: 'Member ID (Discord snowflake)',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Discord username', example: 'johndoe' })
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
    description: 'Email address from Discord',
    example: 'johndoe@example.com',
    nullable: true,
  })
  email: string | null;

  @ApiProperty({
    description: 'Whether the member has the system admin flag set',
    example: true,
  })
  isSystemAdmin: boolean;
}

export class AdminLoginResponseDto {
  @ApiProperty({
    description:
      'Bearer token — include as `Authorization: Bearer <token>` on all admin endpoints',
    example: 'a1b2c3d4e5f6...',
  })
  token: string;

  @ApiProperty({
    description: 'ISO 8601 timestamp when the session token expires (24 h from issue)',
    example: '2026-03-13T05:00:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Authenticated system-admin member',
    type: () => AdminLoginMemberDto,
  })
  member: AdminLoginMemberDto;
}
