import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionClientInfoDto {
  @ApiPropertyOptional({
    description: 'User agent captured when the session was created',
    example:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    nullable: true,
  })
  userAgent: string | null;

  @ApiPropertyOptional({
    description: 'IP address captured when the session was created',
    example: '192.0.2.10',
    nullable: true,
  })
  ipAddress: string | null;
}

export class SessionListItemDto {
  @ApiProperty({
    description: 'Session ID',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Project this session was created for',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    nullable: true,
  })
  projectId: string | null;

  @ApiPropertyOptional({
    description: 'Discord server the session was verified against',
    example: '123456789012345678',
    nullable: true,
  })
  serverId: string | null;

  @ApiProperty({
    description: 'When the session was created',
    example: '2026-06-22T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the session expires',
    example: '2026-06-29T12:00:00.000Z',
  })
  expiresAt: Date;

  @ApiPropertyOptional({
    description: 'Client metadata captured at session creation',
    type: SessionClientInfoDto,
    nullable: true,
  })
  clientInfo: SessionClientInfoDto | null;
}

export class SessionListResponseDto {
  @ApiProperty({
    description: 'Active sessions for the authenticated member',
    type: [SessionListItemDto],
  })
  sessions: SessionListItemDto[];
}
