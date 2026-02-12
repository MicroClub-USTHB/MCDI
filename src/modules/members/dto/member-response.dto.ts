/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Expose, Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class MemberRoleDto {
  @ApiProperty({
    description: 'Role ID',
    example: '123456789012345678',
  })
  @Expose()
  id: string;

  @ApiProperty({ description: 'Role name', example: 'Admin' })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'Role color in decimal',
    required: false,
    example: 16711680,
  })
  @Expose()
  @Transform(({ value }) => value || null)
  color?: number;

  @ApiProperty({
    description: 'Role position (higher = more permissions)',
    example: 1,
  })
  @Expose()
  position: number;
}

export class MemberResponseDto {
  @ApiProperty({
    description: 'Discord user ID',
    example: '123456789012345678',
  })
  @Expose()
  discordId: string;

  @ApiProperty({ description: 'Discord username', example: 'john_doe' })
  @Expose()
  username: string;

  @ApiProperty({
    description: 'Global display name',
    required: false,
    example: 'John Doe',
  })
  @Expose()
  @Transform(({ value }) => value || null)
  globalName?: string;

  @ApiProperty({
    description: 'Server nickname',
    required: false,
    example: 'John',
  })
  @Expose()
  @Transform(({ value }) => value || null)
  displayName?: string;

  @ApiProperty({
    description: 'Avatar URL',
    required: false,
    example: 'https://cdn.discordapp.com/avatars/.../...png',
  })
  @Expose()
  @Transform(({ value }) => value || null)
  avatar?: string;

  @ApiProperty({
    description: 'Whether the member is in the main club server',
    example: true,
  })
  @Expose()
  isClubMember: boolean;

  @ApiProperty({
    description: 'Date the member joined this server',
    required: false,
    example: '2025-01-15T14:30:00.000Z',
  })
  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value || null,
  )
  joinedAt?: string;

  @ApiProperty({
    description: 'Roles assigned to the member in this server',
    type: [MemberRoleDto],
  })
  @Expose()
  @Type(() => MemberRoleDto)
  roles: MemberRoleDto[];
}

export class MemberSearchResponseDto {
  @ApiProperty({
    description: 'Discord user ID',
    example: '123456789012345678',
  })
  @Expose()
  discordId: string;

  @ApiProperty({ description: 'Discord username', example: 'john_doe' })
  @Expose()
  username: string;

  @ApiProperty({
    description: 'Global display name',
    required: false,
    example: 'John Doe',
  })
  @Expose()
  @Transform(({ value }) => value || null)
  globalName?: string;

  @ApiProperty({
    description: 'Server nickname',
    required: false,
    example: 'John',
  })
  @Expose()
  @Transform(({ value }) => value || null)
  displayName?: string;

  @ApiProperty({
    description: 'Avatar URL',
    required: false,
    example: 'https://cdn.discordapp.com/avatars/.../...png',
  })
  @Expose()
  @Transform(({ value }) => value || null)
  avatar?: string;

  @ApiProperty({
    description: 'Whether the member is in the main club server',
    example: true,
  })
  @Expose()
  isClubMember: boolean;

  @ApiProperty({
    description: 'Date the member joined this server',
    required: false,
    example: '2025-01-15T14:30:00.000Z',
  })
  @Expose()
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value || null,
  )
  joinedAt?: string;
}
