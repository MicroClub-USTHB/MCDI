import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Represents a role within a Discord server.
 */
export class RoleDto {
  @ApiProperty({
    description: 'Discord role ID',
    example: '111222333444555666',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Role name',
    example: 'Moderator',
    type: String,
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Role color as an integer',
    example: 16711680,
    nullable: true,
    type: Number,
  })
  color: number | null;

  @ApiPropertyOptional({
    description: 'Role position in the hierarchy',
    example: 5,
    nullable: true,
    type: Number,
  })
  position: number | null;
}

/**
 * Represents a single server a member belongs to,
 * including their roles and join date within that server.
 */
export class MemberServerDetailDto {
  @ApiProperty({
    description: 'Discord server ID',
    example: '123456789012345678',
    type: String,
  })
  serverId: string;

  @ApiProperty({
    description: 'Server name',
    example: 'MicroClub Main',
    type: String,
  })
  serverName: string;

  @ApiPropertyOptional({
    description: 'Server icon hash',
    nullable: true,
    type: String,
  })
  serverIcon: string | null;

  @ApiProperty({
    description: 'Whether this is the main club server',
    example: true,
    type: Boolean,
  })
  isMainServer: boolean;

  @ApiPropertyOptional({
    description: 'ISO date when the member joined this server',
    example: '2025-01-15T10:30:00.000Z',
    nullable: true,
    type: String,
  })
  joinedAt: string | null;

  @ApiProperty({
    description: 'Roles held in this server',
    type: () => [RoleDto],
  })
  roles: RoleDto[];
}

/**
 * Full cross-server view for a single Discord member.
 */
export class MemberCrossServerViewDto {
  @ApiProperty({
    description: 'Discord user ID',
    example: '876543210987654321',
    type: String,
  })
  memberId: string;

  @ApiProperty({
    description: 'Discord username',
    example: 'john_doe',
    type: String,
  })
  username: string;

  @ApiPropertyOptional({
    description: 'Discord global display name',
    example: 'John Doe',
    nullable: true,
    type: String,
  })
  globalName: string | null;

  @ApiPropertyOptional({
    description: 'Server-specific display name',
    example: 'Johnny',
    nullable: true,
    type: String,
  })
  displayName: string | null;

  @ApiPropertyOptional({
    description: 'Avatar hash',
    nullable: true,
    type: String,
  })
  avatar: string | null;

  @ApiProperty({
    description: 'Whether the member is in the main club server',
    example: true,
    type: Boolean,
  })
  isClubMember: boolean;

  @ApiProperty({
    description: 'Servers the member belongs to',
    type: () => [MemberServerDetailDto],
  })
  servers: MemberServerDetailDto[];
}
