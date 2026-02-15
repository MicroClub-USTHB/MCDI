import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a role within a Discord server.
 */
export class RoleDto {
  @ApiProperty({ description: 'Discord role ID', example: '111222333444555666' })
  id: string;

  @ApiProperty({ description: 'Role name', example: 'Moderator' })
  name: string;

  @ApiPropertyOptional({
    description: 'Role color as an integer',
    example: 16711680,
    nullable: true,
  })
  color: number | null;

  @ApiPropertyOptional({
    description: 'Role position in the hierarchy',
    example: 5,
    nullable: true,
  })
  position: number | null;
}

/**
 * Represents a single server a member belongs to,
 * including their roles and join date within that server.
 */
export class MemberServerDetailDto {
  @ApiProperty({ description: 'Discord server ID', example: '123456789012345678' })
  serverId: string;

  @ApiProperty({ description: 'Server name', example: 'MicroClub Main' })
  serverName: string;

  @ApiPropertyOptional({ description: 'Server icon hash', nullable: true })
  serverIcon: string | null;

  @ApiProperty({ description: 'Whether this is the main club server', example: true })
  isMainServer: boolean;

  @ApiPropertyOptional({
    description: 'ISO date when the member joined this server',
    example: '2025-01-15T10:30:00.000Z',
    nullable: true,
  })
  joinedAt: string | null;

  @ApiProperty({ description: 'Roles held in this server', type: [RoleDto] })
  roles: RoleDto[];
}

/**
 * Full cross-server view for a single Discord member.
 */
export class MemberCrossServerViewDto {
  @ApiProperty({ description: 'Discord user ID', example: '876543210987654321' })
  memberId: string;

  @ApiProperty({ description: 'Discord username', example: 'john_doe' })
  username: string;

  @ApiPropertyOptional({ description: 'Discord global display name', example: 'John Doe', nullable: true })
  globalName: string | null;

  @ApiPropertyOptional({ description: 'Server-specific display name', example: 'Johnny', nullable: true })
  displayName: string | null;

  @ApiPropertyOptional({ description: 'Avatar hash', nullable: true })
  avatar: string | null;

  @ApiProperty({ description: 'Whether the member is in the main club server', example: true })
  isClubMember: boolean;

  @ApiProperty({ description: 'Servers the member belongs to', type: [MemberServerDetailDto] })
  servers: MemberServerDetailDto[];
}
