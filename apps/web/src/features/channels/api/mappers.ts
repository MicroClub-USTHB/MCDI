import type {
  ChannelDetailDto,
  ChannelDto,
  ChannelListResponseDto,
  MessageDto,
} from '@/features/channels/types';

/* ─── colour ─────────────────────────────────────────────────────────────── */

/** `5793266` → `"#5865f2"`, clamped to the 24-bit range. */
export function decimalToHex(value: number): string {
  const clamped = Math.max(0, Math.min(0xffffff, Math.trunc(value)));
  return `#${clamped.toString(16).padStart(6, '0')}`;
}

/* ─── channels ───────────────────────────────────────────────────────────── */

const TEXTUAL_TYPES: ReadonlySet<ChannelDto['type']> = new Set(['text', 'announcement']);

export interface ChannelNode {
  id: string;
  name: string;
  type: ChannelDto['type'];
  topic: string | null;
  nsfw: boolean;
  hasOverwrites: boolean;
  /** `text`/`announcement` channels have a readable message history; `voice`/`category` don't. */
  hasMessages: boolean;
}

export interface ChannelGroup {
  id: string | null;
  name: string;
  channels: ChannelNode[];
}

export interface ChannelTreeModel {
  groups: ChannelGroup[];
  byId: Map<string, ChannelNode>;
  /** First text channel, for a sensible default selection. */
  firstTextChannelId: string | null;
}

function toNode(dto: ChannelDto): ChannelNode {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    topic: dto.topic,
    nsfw: dto.nsfw,
    hasOverwrites: dto.permissionOverwrites,
    hasMessages: TEXTUAL_TYPES.has(dto.type),
  };
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/**
 * Groups channels under their category (issue AC: "Channels grouped by category
 * in tree view"). Categories come from `categories[].children`; anything a
 * category doesn't claim, and isn't itself a category, lands in "Uncategorized".
 */
export function mapChannelTree(dto: ChannelListResponseDto): ChannelTreeModel {
  const realChannels = dto.channels.filter((c) => c.type !== 'category');
  const nodeById = new Map<string, ChannelNode>(realChannels.map((c) => [c.id, toNode(c)]));
  const positionById = new Map(dto.channels.map((c) => [c.id, c.position]));

  const claimed = new Set<string>();
  const groups: ChannelGroup[] = [];

  for (const category of [...dto.categories].sort(byPosition)) {
    const channels: ChannelNode[] = [];
    for (const childId of category.children) {
      const node = nodeById.get(childId);
      if (!node) continue;
      claimed.add(childId);
      channels.push(node);
    }
    channels.sort((a, b) => (positionById.get(a.id) ?? 0) - (positionById.get(b.id) ?? 0));
    groups.push({ id: category.id, name: category.name, channels });
  }

  const orphans = realChannels
    .filter((c) => !claimed.has(c.id))
    .sort(byPosition)
    .map((c) => nodeById.get(c.id))
    .filter((n): n is ChannelNode => Boolean(n));

  if (orphans.length > 0) {
    groups.push({ id: null, name: 'Uncategorized', channels: orphans });
  }

  let firstTextChannelId: string | null = null;
  for (const group of groups) {
    const textual = group.channels.find((c) => c.hasMessages);
    if (textual) {
      firstTextChannelId = textual.id;
      break;
    }
  }

  return { groups, byId: nodeById, firstTextChannelId };
}

const TYPE_LABEL: Record<string, string> = {
  text: 'Text channel',
  voice: 'Voice channel',
  announcement: 'Announcement channel',
  category: 'Category',
};

export interface ChannelDetailView {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  topic: string | null;
  nsfw: boolean;
  createdAt: string;
  /** How many per-target permission overwrites the channel carries. */
  overwriteCount: number;
}

export function mapChannelDetail(dto: ChannelDetailDto): ChannelDetailView {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    typeLabel: TYPE_LABEL[dto.type] ?? dto.type,
    topic: dto.topic,
    nsfw: dto.nsfw,
    createdAt: dto.createdAt,
    overwriteCount: dto.overwrites?.length ?? 0,
  };
}

/* ─── messages ───────────────────────────────────────────────────────────── */

/** Resolve a Discord avatar hash (or passthrough URL) to something `<img>` can load. */
export function authorAvatarUrl(author: { id: string; avatar?: string | null }): string | null {
  if (!author.avatar) return null;
  if (author.avatar.startsWith('http')) return author.avatar;
  return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.png`;
}

export interface MessageEmbedView {
  title: string | null;
  description: string | null;
  url: string | null;
  /** `#RRGGBB` derived from the decimal colour, or `null`. */
  hexColor: string | null;
}

export interface MessageView {
  id: string;
  content: string;
  authorName: string;
  authorAvatarUrl: string | null;
  timestamp: string;
  embeds: MessageEmbedView[];
  attachmentCount: number;
}

export function mapMessage(dto: MessageDto): MessageView {
  return {
    id: dto.id,
    content: dto.content,
    authorName: dto.author.username,
    authorAvatarUrl: authorAvatarUrl(dto.author),
    timestamp: dto.timestamp,
    embeds: (dto.embeds ?? []).map((embed) => ({
      title: embed.title ?? null,
      description: embed.description ?? null,
      url: embed.url ?? null,
      hexColor:
        embed.color === null || embed.color === undefined ? null : decimalToHex(embed.color),
    })),
    attachmentCount: dto.attachments?.length ?? 0,
  };
}

export function mapMessageList(dtos: MessageDto[]): MessageView[] {
  return dtos.map(mapMessage);
}
