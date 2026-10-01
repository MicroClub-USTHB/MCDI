/** Raw channel row from `GET /api/admin/servers/:serverId/channels`. */
export interface ChannelDto {
  id: string;
  name: string;
  type: 'text' | 'voice' | 'announcement' | 'category';
  position: number;
  parentId: string | null;
  topic: string | null;
  nsfw: boolean;
  permissionOverwrites: boolean;
  lastMessageId?: string | null;
  createdAt?: string;
}

/** A category groups channels; `children` holds channel IDs in display order. */
export interface ChannelCategoryDto {
  id: string;
  name: string;
  position: number;
  children: string[];
}

export interface ChannelListResponseDto {
  channels: ChannelDto[];
  categories: ChannelCategoryDto[];
}

/** One per-target permission overwrite configured on a channel. */
export interface ChannelPermissionOverwriteDto {
  id: string;
  type: 'role' | 'member';
  /** Discord permission bitfield as a decimal string. */
  allow: string;
  deny: string;
}

/** `GET /api/admin/servers/:serverId/channels/:channelId`. */
export interface ChannelDetailDto {
  id: string;
  name: string;
  type: string;
  position: number;
  parentId: string | null;
  topic: string | null;
  nsfw: boolean;
  lastMessageId: string | null;
  createdAt: string;
  permissionOverwrites: boolean;
  overwrites: ChannelPermissionOverwriteDto[];
}

export interface MessageAuthorDto {
  id: string;
  username: string;
  avatar?: string | null;
}

export interface MessageEmbedDto {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  color?: number | null;
  type?: string;
}

export interface MessageAttachmentDto {
  id: string;
  url: string;
  filename: string;
  size: number;
}

export interface MessageMentionDto {
  id: string;
  name?: string | null;
}

/** One row of `GET /api/admin/servers/:serverId/channels/:channelId/messages`. */
export interface MessageDto {
  id: string;
  content: string;
  author: MessageAuthorDto;
  timestamp: string;
  embeds: MessageEmbedDto[];
  attachments: MessageAttachmentDto[];
  mentions: MessageMentionDto[];
}

export interface MessageHistoryResponseDto {
  messages: MessageDto[];
  hasMore: boolean;
}

export const MESSAGE_HISTORY_LIMIT = 50;
