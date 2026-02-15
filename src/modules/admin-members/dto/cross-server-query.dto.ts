import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for the paginated cross-server member list.
 *
 * GET /admin/members/cross-server?filter=club|all&page=1&limit=20&search=
 */
export class CrossServerQueryDto {
  @ApiProperty({
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

/**
 * Query parameters for the export endpoint.
 */
export class ExportQueryDto {
  @ApiProperty({
    description: 'Filter type for export',
    enum: ['club', 'all'],
    default: 'all',
    example: 'all',
  })
  @IsIn(['club', 'all'])
  @IsOptional()
  filter: 'club' | 'all' = 'all';

  @ApiProperty({
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
  })
  serverId: string;

  @ApiProperty({ description: 'Server name', example: 'MicroClub Main' })
  serverName: string;

  @ApiProperty({
    description: 'Whether this is the main club server',
    example: true,
  })
  isMainServer: boolean;

  @ApiPropertyOptional({
    description: 'ISO date when the member joined this server',
    example: '2025-01-15T10:30:00.000Z',
    nullable: true,
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

  @ApiProperty({ description: 'Discord username', example: 'john_doe' })
  username: string;

  @ApiPropertyOptional({
    description: 'Discord global display name',
    example: 'John Doe',
    nullable: true,
  })
  globalName: string | null;

  @ApiPropertyOptional({ description: 'Avatar hash', nullable: true })
  avatar: string | null;

  @ApiProperty({
    description: 'Whether the member is in the main club server',
    example: true,
  })
  isClubMember: boolean;

  @ApiProperty({
    description: 'Number of managed servers the member is in',
    example: 3,
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
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 8 })
  totalPages: number;
}
