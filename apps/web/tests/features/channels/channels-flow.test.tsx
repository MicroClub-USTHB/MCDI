import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { ChannelsView } from '@/app/dashboard/servers/[id]/channels/channels-view';

const BASE_URL = 'http://localhost:3000/api';

function serverDto(id: string, name: string) {
  return {
    id,
    name,
    icon: null,
    type: 'main',
    isMain: id === 's-main',
    isActive: true,
    syncFrequencyHours: 24,
    defaultPermissionPolicy: 'custom',
    disabledReason: null,
    syncedAt: null,
    lastSyncAt: null,
    botConnected: true,
  };
}

const channelList = {
  categories: [{ id: 'cat-1', name: 'Text Channels', position: 0, children: ['tc-1', 'vc-1'] }],
  channels: [
    {
      id: 'tc-1',
      name: 'general',
      type: 'text',
      position: 0,
      parentId: 'cat-1',
      topic: 'Say hi',
      nsfw: false,
      permissionOverwrites: true,
    },
    {
      id: 'vc-1',
      name: 'Lounge',
      type: 'voice',
      position: 1,
      parentId: 'cat-1',
      topic: null,
      nsfw: false,
      permissionOverwrites: false,
    },
  ],
};

const channelDetail = {
  id: 'tc-1',
  name: 'general',
  type: 'text',
  position: 0,
  parentId: 'cat-1',
  topic: 'Say hi',
  nsfw: false,
  lastMessageId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  permissionOverwrites: true,
  overwrites: [{ id: 'r1', type: 'role', allow: '1024', deny: '0' }],
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('channels flow (read-only)', () => {
  it('lists channels by category, auto-selects the first text channel, and shows its detail', async () => {
    server.use(
      http.get(`${BASE_URL}/servers`, () =>
        HttpResponse.json([serverDto('s-main', 'Main Server'), serverDto('s-events', 'Events')])
      ),
      http.get(`${BASE_URL}/admin/servers/s-main/channels`, () => HttpResponse.json(channelList)),
      http.get(`${BASE_URL}/admin/servers/s-main/channels/tc-1`, () =>
        HttpResponse.json(channelDetail)
      )
    );

    render(<ChannelsView serverId="s-main" />, { wrapper });

    await screen.findByText('Text Channels');
    const generalButton = screen.getByRole('button', { name: /general/ });
    expect(generalButton).toHaveAttribute('aria-current', 'true');
    expect(await screen.findByText('Say hi')).toBeInTheDocument();
    expect(await screen.findByText('1 permission overwrite')).toBeInTheDocument();
  }, 15000);

  it('loads message history on demand from the admin route', async () => {
    let historyHits = 0;

    server.use(
      http.get(`${BASE_URL}/servers`, () =>
        HttpResponse.json([serverDto('s-main', 'Main Server')])
      ),
      http.get(`${BASE_URL}/admin/servers/s-main/channels`, () => HttpResponse.json(channelList)),
      http.get(`${BASE_URL}/admin/servers/s-main/channels/tc-1`, () =>
        HttpResponse.json({ ...channelDetail, permissionOverwrites: false, overwrites: [] })
      ),
      http.get(`${BASE_URL}/admin/servers/s-main/channels/tc-1/messages`, ({ request }) => {
        historyHits += 1;
        expect(new URL(request.url).searchParams.get('limit')).toBe('50');
        return HttpResponse.json({
          hasMore: true,
          messages: [
            {
              id: 'm-9',
              content: 'earlier message',
              author: { id: 'u1', username: 'alice', avatar: null },
              timestamp: '2026-08-28T09:00:00.000Z',
              embeds: [],
              attachments: [],
              mentions: [],
            },
          ],
        });
      })
    );

    const user = userEvent.setup();
    render(<ChannelsView serverId="s-main" />, { wrapper });

    await screen.findByText('Text Channels');
    expect(historyHits).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Load recent messages' }));

    expect(await screen.findByText('earlier message')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(/older messages aren’t shown/)).toBeInTheDocument();
    expect(historyHits).toBe(1);
  }, 15000);

  it('shows the channels of the server in the URL, with no server picker of its own', async () => {
    server.use(
      http.get(`${BASE_URL}/admin/servers/s-events/channels`, () =>
        HttpResponse.json({ channels: [], categories: [] })
      )
    );

    render(<ChannelsView serverId="s-events" />, { wrapper });

    expect(await screen.findByText('No channels')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Select a server' })).toBeNull();
  });
});
