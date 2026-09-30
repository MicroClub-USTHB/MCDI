import { ApiProperty } from '@nestjs/swagger';

export class WebhookCreatedResponseDto {
  @ApiProperty({
    description: 'Webhook ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  id: string;

  @ApiProperty({ description: 'Webhook name', example: 'Deploy notifications' })
  name: string;

  @ApiProperty({
    description: 'Discord channel ID',
    example: '123456789012345678',
  })
  channelId: string;

  @ApiProperty({
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  serverId: string;

  @ApiProperty({
    description: 'Owning project ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  projectId: string;

  @ApiProperty({
    description: 'ISO 8601 creation timestamp',
    example: '2025-01-15T14:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({ description: 'Number of executions', example: 0 })
  usageCount: number;
}

export class WebhookSummaryDto {
  @ApiProperty({
    description: 'Webhook ID',
    example: '3f6f7f9a-4c1a-4a9e-9d7b-2f1f4b6a8c0d',
  })
  id: string;

  @ApiProperty({ description: 'Webhook name', example: 'Deploy notifications' })
  name: string;

  @ApiProperty({
    description: 'Discord channel ID',
    example: '123456789012345678',
  })
  channelId: string;

  @ApiProperty({
    description: 'Channel name from the bot cache',
    nullable: true,
    example: 'general',
  })
  channelName: string | null;

  @ApiProperty({
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  serverId: string;

  @ApiProperty({
    description: 'Server name from the bot cache',
    nullable: true,
    example: 'MicroClub',
  })
  serverName: string | null;

  @ApiProperty({
    description: 'ISO 8601 creation timestamp',
    example: '2025-01-15T14:30:00.000Z',
  })
  createdAt: string;

  @ApiProperty({ description: 'Number of executions', example: 0 })
  usageCount: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp of the last execution',
    nullable: true,
    example: '2025-01-15T14:30:00.000Z',
  })
  lastUsedAt: string | null;
}

export class WebhookListResponseDto {
  @ApiProperty({ type: [WebhookSummaryDto] })
  webhooks: WebhookSummaryDto[];

  @ApiProperty({
    description: 'Total webhooks matching the filter',
    example: 1,
  })
  total: number;

  @ApiProperty({ description: 'Applied limit', example: 50 })
  limit: number;

  @ApiProperty({ description: 'Applied offset', example: 0 })
  offset: number;
}

export class WebhookDetailResponseDto extends WebhookSummaryDto {
  @ApiProperty({
    description: 'Discord avatar hash',
    nullable: true,
    example: 'a1b2c3d4e5f6',
  })
  avatar: string | null;
}
