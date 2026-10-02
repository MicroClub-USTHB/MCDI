import { describe, expect, it } from 'vitest';

import {
  decimalToHex,
  mapChannelDetail,
  mapChannelTree,
  mapMessage,
} from '@/features/channels/api/mappers';
import type {
  ChannelDetailDto,
  ChannelListResponseDto,
  MessageDto,
} from '@/features/channels/types';

describe('decimalToHex', () => {
  it('formats a colour', () => {
    expect(decimalToHex(0x5865f2)).toBe('#5865f2');
  });

  it('clamps out-of-range decimals', () => {
    expect(decimalToHex(-10)).toBe('#000000');
    expect(decimalToHex(0xffffff + 5)).toBe('#ffffff');
  });
});

describe('mapChannelTree', () => {
  const dto: ChannelListResponseDto = {
    categories: [
      { id: 'cat-2', name: 'Voice', position: 1, children: ['vc-1'] },
      { id: 'cat-1', name: 'Text', position: 0, children: ['tc-2', 'tc-1'] },
    ],
    channels: [
      {
        id: 'tc-1',
        name: 'general',
        type: 'text',
        position: 1,
        parentId: 'cat-1',
        topic: null,
        nsfw: false,
        permissionOverwrites: false,
      },
      {
        id: 'tc-2',
        name: 'announcements',
        type: 'announcement',
        position: 0,
        parentId: 'cat-1',
        topic: 'News',
        nsfw: false,
        permissionOverwrites: true,
      },
      {
        id: 'vc-1',
        name: 'Lounge',
        type: 'voice',
        position: 0,
        parentId: 'cat-2',
        topic: null,
        nsfw: false,
        permissionOverwrites: false,
      },
      {
        id: 'orphan',
        name: 'rules',
        type: 'text',
        position: 5,
        parentId: null,
        topic: null,
        nsfw: false,
        permissionOverwrites: false,
      },
      {
        id: 'cat-1',
        name: 'Text',
        type: 'category',
        position: 0,
        parentId: null,
        topic: null,
        nsfw: false,
        permissionOverwrites: false,
      },
    ],
  };

  it('groups channels under categories ordered by position, child order by channel position', () => {
    const tree = mapChannelTree(dto);
    expect(tree.groups.map((g) => g.name)).toEqual(['Text', 'Voice', 'Uncategorized']);
    expect(tree.groups[0]?.channels.map((c) => c.id)).toEqual(['tc-2', 'tc-1']);
  });

  it('drops category rows from the flat map and buckets unclaimed channels', () => {
    const tree = mapChannelTree(dto);
    expect(tree.byId.has('cat-1')).toBe(false);
    expect(tree.groups.at(-1)).toMatchObject({ id: null, name: 'Uncategorized' });
    expect(tree.groups.at(-1)?.channels.map((c) => c.id)).toEqual(['orphan']);
  });

  it('marks only text/announcement channels as having a message history and picks the first as default', () => {
    const tree = mapChannelTree(dto);
    expect(tree.byId.get('vc-1')?.hasMessages).toBe(false);
    expect(tree.byId.get('tc-2')?.hasMessages).toBe(true);
    expect(tree.firstTextChannelId).toBe('tc-2');
  });
});

describe('mapChannelDetail', () => {
  const base: ChannelDetailDto = {
    id: 'tc-1',
    name: 'general',
    type: 'text',
    position: 0,
    parentId: 'cat-1',
    topic: 'hi',
    nsfw: false,
    lastMessageId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    permissionOverwrites: true,
    overwrites: [
      { id: 'r1', type: 'role', allow: '1024', deny: '0' },
      { id: 'm1', type: 'member', allow: '0', deny: '2048' },
    ],
  };

  it('labels the type and counts permission overwrites', () => {
    const view = mapChannelDetail(base);
    expect(view.typeLabel).toBe('Text channel');
    expect(view.overwriteCount).toBe(2);
  });

  it('tolerates a missing overwrites array', () => {
    const view = mapChannelDetail({ ...base, overwrites: undefined as never });
    expect(view.overwriteCount).toBe(0);
  });
});

describe('mapMessage', () => {
  const base: MessageDto = {
    id: 'm1',
    content: 'hi',
    author: { id: 'u1', username: 'bot', avatar: 'abc123' },
    timestamp: '2026-08-29T10:00:00.000Z',
    embeds: [{ title: 'E', description: 'd', color: 0xff0000 }],
    attachments: [{ id: 'a', url: 'u', filename: 'f', size: 1 }],
    mentions: [],
  };

  it('resolves an avatar hash to the Discord CDN and a decimal embed colour to hex', () => {
    const view = mapMessage(base);
    expect(view.authorAvatarUrl).toBe('https://cdn.discordapp.com/avatars/u1/abc123.png');
    expect(view.embeds[0]?.hexColor).toBe('#ff0000');
    expect(view.attachmentCount).toBe(1);
  });

  it('passes a full avatar URL through and tolerates a null colour', () => {
    const view = mapMessage({
      ...base,
      author: { id: 'u1', username: 'bot', avatar: 'https://cdn/x.png' },
      embeds: [{ title: 'E', color: null }],
    });
    expect(view.authorAvatarUrl).toBe('https://cdn/x.png');
    expect(view.embeds[0]?.hexColor).toBeNull();
  });
});
