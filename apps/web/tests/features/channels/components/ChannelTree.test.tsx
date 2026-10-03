import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { mapChannelTree } from '@/features/channels/api/mappers';
import { ChannelTree } from '@/features/channels/components';
import type { ChannelDto, ChannelListResponseDto } from '@/features/channels/types';

function channel(id: string, name: string, type: ChannelDto['type'], position: number) {
  return {
    id,
    name,
    type,
    position,
    parentId: type === 'category' ? null : 'cat',
    topic: null,
    nsfw: false,
    permissionOverwrites: false,
  };
}

/** The shape `GET /api/admin/servers/:id/channels` returns for a server with a forum channel. */
const withForum: ChannelListResponseDto = {
  channels: [
    channel('cat', 'Community', 'category', 0),
    channel('gen', 'general', 'text', 1),
    channel('forum', 'help-forum', 'unknown', 2),
    channel('stage', 'town-hall', 'unknown', 3),
  ],
  categories: [{ id: 'cat', name: 'Community', position: 0, children: ['gen', 'forum', 'stage'] }],
};

describe('ChannelTree', () => {
  it('renders forum, stage and media channels instead of crashing', () => {
    const tree = mapChannelTree(withForum);

    render(<ChannelTree groups={tree.groups} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'general' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'help-forum' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'town-hall' })).toBeInTheDocument();
  });

  it('keeps a long channel list in its own scroll area', () => {
    const tree = mapChannelTree(withForum);

    render(<ChannelTree groups={tree.groups} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Channels' })).toHaveClass('overflow-y-auto');
  });
});
