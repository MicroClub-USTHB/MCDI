import { describe, it, expect } from 'vitest';
import { mapWebhookList, mapWebhookResponse } from '@/features/webhooks/api/mappers';
import type { WebhookDto } from '@/features/webhooks/types';

const dto: WebhookDto = {
  id: 'wh_1',
  name: 'Deploy notifications',
  channelId: '234567890123456789',
  channelName: 'deployments',
  serverId: '123456789012345678',
  serverName: 'MicroClub',
  createdAt: '2026-08-01T10:00:00.000Z',
  usageCount: 1234,
  lastUsedAt: '2026-08-15T09:30:00.000Z',
};

describe('mapWebhookResponse', () => {
  it('labels the channel and server by name', () => {
    const view = mapWebhookResponse(dto);

    expect(view.id).toBe('wh_1');
    expect(view.name).toBe('Deploy notifications');
    expect(view.channelLabel).toBe('#deployments');
    expect(view.serverLabel).toBe('MicroClub');
    expect(view.usageCount).toBe(1234);
    expect(view.lastUsedLabel).not.toBe('Never');
    expect(view.createdAtLabel).not.toBe('—');
  });

  it('falls back to the IDs when the bot cache has no names', () => {
    const view = mapWebhookResponse({ ...dto, channelName: null, serverName: null });

    expect(view.channelLabel).toBe('234567890123456789');
    expect(view.serverLabel).toBe('123456789012345678');
  });

  it('labels a webhook that was never executed', () => {
    expect(mapWebhookResponse({ ...dto, lastUsedAt: null }).lastUsedLabel).toBe('Never');
  });

  it('carries no URL or token, whatever the response contains', () => {
    const view = mapWebhookResponse({
      ...dto,
      url: 'https://discord.com/api/webhooks/1/secret',
      token: 'secret',
    } as WebhookDto);

    expect(Object.keys(view)).not.toEqual(expect.arrayContaining(['url']));
    expect(JSON.stringify(view)).not.toContain('secret');
  });
});

describe('mapWebhookList', () => {
  it('maps every webhook and keeps the total', () => {
    const list = mapWebhookList({ webhooks: [dto], total: 1, limit: 100, offset: 0 });

    expect(list.total).toBe(1);
    expect(list.webhooks.map((w) => w.id)).toEqual(['wh_1']);
  });
});
