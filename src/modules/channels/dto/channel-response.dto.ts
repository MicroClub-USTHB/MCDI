import { ApiProperty } from '@nestjs/swagger';

export class ChannelResponseDto {
  @ApiProperty({
    description: 'Discord channel ID',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Channel name', example: 'general' })
  name: string;

  @ApiProperty({
    description: 'Channel type',
    example: 'text',
    enum: ['text', 'voice', 'announcement', 'category'],
  })
  type: string;

  @ApiProperty({ description: 'Position in the channel list', example: 0 })
  position: number;

  @ApiProperty({
    description: 'Parent category ID',
    nullable: true,
    example: '123456789012345678',
  })
  parentId: string | null;

  @ApiProperty({
    description: 'Channel topic',
    nullable: true,
    example: 'Discussion',
  })
  topic: string | null;

  @ApiProperty({ description: 'Whether the channel is NSFW', example: false })
  nsfw: boolean;

  @ApiProperty({
    description: 'Whether the channel has permission overwrites',
    example: false,
  })
  permissionOverwrites: boolean;

  @ApiProperty({
    description: 'Last message ID',
    nullable: true,
    example: '123456789012345678',
  })
  lastMessageId?: string | null;

  @ApiProperty({
    description: 'ISO 8601 creation timestamp',
    example: '2025-01-15T14:30:00.000Z',
  })
  createdAt?: string;
}

export class ChannelCategoryDto {
  @ApiProperty({ description: 'Category ID', example: '123456789012345678' })
  id: string;

  @ApiProperty({ description: 'Category name', example: 'Text Channels' })
  name: string;

  @ApiProperty({ description: 'Position', example: 0 })
  position: number;

  @ApiProperty({
    description: 'Child channel IDs',
    type: [String],
    example: ['123456789012345678'],
  })
  children: string[];
}

export class ChannelListResponseDto {
  @ApiProperty({ type: [ChannelResponseDto] })
  channels: ChannelResponseDto[];

  @ApiProperty({ type: [ChannelCategoryDto] })
  categories: ChannelCategoryDto[];
}

export class ChannelPermissionOverwriteDto {
  @ApiProperty({
    description: 'Role or member ID the overwrite targets',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({
    description: 'Whether the overwrite targets a role or a member',
    enum: ['role', 'member'],
    example: 'role',
  })
  type: 'role' | 'member';

  @ApiProperty({
    description: 'Allowed permission bits (Discord bitfield as a string)',
    example: '1024',
  })
  allow: string;

  @ApiProperty({
    description: 'Denied permission bits (Discord bitfield as a string)',
    example: '0',
  })
  deny: string;
}

export class ChannelDetailResponseDto {
  @ApiProperty({
    description: 'Discord channel ID',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Channel name', example: 'general' })
  name: string;

  @ApiProperty({ description: 'Channel type', example: 'text' })
  type: string;

  @ApiProperty({ description: 'Position', example: 0 })
  position: number;

  @ApiProperty({
    description: 'Parent category ID',
    nullable: true,
    example: '123456789012345678',
  })
  parentId: string | null;

  @ApiProperty({
    description: 'Channel topic',
    nullable: true,
    example: 'Discussion',
  })
  topic: string | null;

  @ApiProperty({ description: 'Whether the channel is NSFW', example: false })
  nsfw: boolean;

  @ApiProperty({
    description: 'Last message ID',
    nullable: true,
    example: '123456789012345678',
  })
  lastMessageId: string | null;

  @ApiProperty({
    description: 'ISO 8601 creation timestamp',
    example: '2025-01-15T14:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Whether the channel has any permission overwrites',
    example: false,
  })
  permissionOverwrites: boolean;

  @ApiProperty({
    description: 'Per-target permission overwrites configured on the channel',
    type: [ChannelPermissionOverwriteDto],
  })
  overwrites: ChannelPermissionOverwriteDto[];
}
