import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SsoMemberDto {
  @ApiProperty({ example: '123456789012345678' })
  id: string;

  @ApiProperty({
    description: 'Discord user ID (same as `id` in MCDI)',
    example: '123456789012345678',
  })
  discordId: string;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'https://cdn.discordapp.com/avatars/.../...png',
  })
  avatar: string | null;
}

export class SsoSessionStatusDto {
  @ApiProperty({ example: true })
  authenticated: boolean;

  @ApiProperty({ type: SsoMemberDto })
  member: SsoMemberDto;

  @ApiProperty({ example: '2026-07-27T12:00:00.000Z' })
  expiresAt: Date;
}

export class SsoSessionUnauthenticatedDto {
  @ApiProperty({ example: false })
  authenticated: boolean;
}

export class SsoProjectSessionDto {
  @ApiProperty({ example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' })
  projectId: string;

  @ApiProperty({ example: 'MCDI Admin' })
  projectName: string;

  @ApiPropertyOptional({ nullable: true, example: '123456789012345678' })
  serverId: string | null;

  @ApiProperty({ example: '2026-06-27T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-07-27T12:00:00.000Z' })
  expiresAt: Date;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Last time this project session was used. Not currently tracked on ' +
      '`sessions`, so returns `createdAt` as a best-effort fallback.',
    example: '2026-06-27T12:00:00.000Z',
  })
  lastUsedAt: Date | null;
}

export class SsoProjectSessionListDto {
  @ApiProperty({ type: [SsoProjectSessionDto] })
  sessions: SsoProjectSessionDto[];
}
