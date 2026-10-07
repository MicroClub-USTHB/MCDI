import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import { ChannelsView } from '@/app/dashboard/servers/[id]/channels/channels-view';

const BASE_URL = 'http://localhost:3000/api';

function serverDto(id: string, name: string) {
  return {
    id,
    name,
    icon: null,
    type: 'main',
    isMain: id === 'srv_1',
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
  categories: [{ id: 'cat-1', name: 'Text Channels', position: 0, children: ['tc-1'] }],
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
  overwrites: [],
};

function mockChannels() {
  server.use(
    http.get(`${BASE_URL}/servers`, () => HttpResponse.json([serverDto('srv_1', 'Main Server')])),
    http.get(`${BASE_URL}/admin/servers/srv_1/channels`, () => HttpResponse.json(channelList)),
    http.get(`${BASE_URL}/admin/servers/srv_1/channels/tc-1`, () =>
      HttpResponse.json(channelDetail)
    )
  );
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderChannels() {
  return render(<ChannelsView serverId="srv_1" />, { wrapper });
}

describe('Channels access', () => {
  it('shows the channel but not its message history without messages:read', async () => {
    mockChannels();
    signInAs({ permissions: { servers: 'read', channels: 'read' } });
    renderChannels();

    await userEvent.click(await screen.findByRole('button', { name: /general/i }));

    expect(await screen.findByText('Say hi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load.*messages/i })).not.toBeInTheDocument();
  }, 15000);

  it('offers the message history with messages:read', async () => {
    mockChannels();
    signInAs({ permissions: { servers: 'read', channels: 'read', messages: 'read' } });
    renderChannels();

    await userEvent.click(await screen.findByRole('button', { name: /general/i }));
    expect(await screen.findByRole('button', { name: /load.*messages/i })).toBeInTheDocument();
  }, 15000);
});
