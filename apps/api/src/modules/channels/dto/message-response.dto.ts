import { ApiProperty } from '@nestjs/swagger';

class MessageAuthorDto {
  @ApiProperty({
    description: 'Discord user ID',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Discord username', example: 'john_doe' })
  username: string;

  @ApiProperty({
    description: 'Avatar hash or URL',
    example: 'a_abc123def456',
    nullable: true,
  })
  avatar?: string | null;
}

class MessageEmbedDto {
  @ApiProperty({ description: 'Embed title', nullable: true })
  title?: string | null;

  @ApiProperty({ description: 'Embed description', nullable: true })
  description?: string | null;

  @ApiProperty({ description: 'Embed URL', nullable: true })
  url?: string | null;

  @ApiProperty({ description: 'Color in decimal', nullable: true })
  color?: number | null;

  @ApiProperty({ description: 'Embed type', nullable: true })
  type?: string;
}

class MessageAttachmentDto {
  @ApiProperty({ description: 'Attachment ID' })
  id: string;

  @ApiProperty({ description: 'Attachment URL' })
  url: string;

  @ApiProperty({ description: 'File name' })
  filename: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;
}

class MentionDto {
  @ApiProperty({ description: 'Mentioned user/role ID' })
  id: string;

  @ApiProperty({ description: 'Mentioned user name', nullable: true })
  name?: string | null;
}

export class MessageDto {
  @ApiProperty({
    description: 'Discord message ID',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({ description: 'Message content', example: 'Hello!' })
  content: string;

  @ApiProperty({ type: () => MessageAuthorDto })
  author: MessageAuthorDto;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  timestamp: string;

  @ApiProperty({ type: [MessageEmbedDto] })
  embeds: MessageEmbedDto[];

  @ApiProperty({ type: [MessageAttachmentDto] })
  attachments: MessageAttachmentDto[];

  @ApiProperty({ type: [MentionDto] })
  mentions: MentionDto[];
}

export class GetMessagesResponseDto {
  @ApiProperty({ type: [MessageDto] })
  messages: MessageDto[];

  @ApiProperty({
    description: 'Whether there are more messages available',
    example: false,
  })
  hasMore: boolean;
}

export class SendMessageResponseDto {
  @ApiProperty({
    description: 'Discord message ID',
    example: '123456789012345678',
  })
  id: string;

  @ApiProperty({
    description: 'Discord channel ID',
    example: '123456789012345678',
  })
  channelId: string;

  @ApiProperty({ description: 'Message content', example: 'Hello!' })
  content: string;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  timestamp: string;

  @ApiProperty({ type: () => MessageAuthorDto })
  author: { id: string; username: string };
}
