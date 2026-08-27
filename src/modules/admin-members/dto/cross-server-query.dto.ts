import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for the paginated cross-server member list.
 *
 * GET /admin/members/cross-server?filter=club|all&page=1&limit=20&search=
 */
export class CrossServerQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter type: "club" = only members in the main server, "all" = any managed server',
    enum: ['club', 'all'],
    default: 'all',
    example: 'club',
  })
  @IsIn(['club', 'all'])
  @IsOptional()
  filter: 'club' | 'all' = 'all';

  @ApiPropertyOptional({
    description:
      'Discord server ID to restrict results to members of a specific server',
    example: '123456789012345678',
  })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiPropertyOptional({
    description:
      'Discord role ID to restrict results to members holding a specific role',
    example: '987654321098765432',
  })
  @IsString()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Search string to filter by username or global name',
    example: 'john',
  })
  @IsString()
  @IsOptional()
  search?: string;
}

export { CrossServerQueryDto as AdminMembersQueryDto };

/**
 * Query parameters for the export endpoint.
 */
export class ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Filter type for export',
    enum: ['club', 'all'],
    default: 'all',
    example: 'all',
  })
  @IsIn(['club', 'all'])
  @IsOptional()
  filter: 'club' | 'all' = 'all';

  @ApiPropertyOptional({
    description: 'Discord server ID to filter export data',
    example: '123456789012345678',
  })
  @IsString()
  @IsOptional()
  serverId?: string;

  @ApiPropertyOptional({
    description: 'Discord role ID to filter export data',
    example: '987654321098765432',
  })
  @IsString()
  @IsOptional()
  roleId?: string;

  @ApiPropertyOptional({
    description:
      'Search string to filter export data by username or global name',
    example: 'john',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Output format',
    enum: ['csv', 'json'],
    default: 'json',
    example: 'json',
  })
  @IsIn(['csv', 'json'])
  @IsOptional()
  format: 'csv' | 'json' = 'json';
}

/**
 * Server summary within a cross-server list item.
 */
export class CrossServerListServerDto {
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
    description: 'Role names the member holds in this server',
    type: [String],
    example: ['Admin', 'Moderator'],
  })
  roleNames: string[];
}

/**
 * A row in the cross-server list view (lighter than the full detail view).
 */
export class CrossServerListItemDto {
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
    description: 'Number of managed servers the member is in',
    example: 3,
    type: Number,
  })
  serverCount: number;

  @ApiProperty({
    description: 'Server details',
    type: () => [CrossServerListServerDto],
  })
  servers: CrossServerListServerDto[];
}

/**
 * Paginated response for the cross-server member list.
 */
export class PaginatedCrossServerListDto {
  @ApiProperty({
    description: 'List of members',
    type: () => [CrossServerListItemDto],
  })
  data: CrossServerListItemDto[];

  @ApiProperty({
    description: 'Total number of matching members',
    example: 150,
    type: Number,
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1, type: Number })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20, type: Number })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
    type: Number,
  })
  totalPages: number;
}
