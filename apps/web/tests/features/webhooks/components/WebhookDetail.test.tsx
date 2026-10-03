import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../setup';
import { WebhookDetail } from '@/features/webhooks/components';
import type { WebhookView } from '@/features/webhooks';
import { useToastStore } from '@/shared/stores/toast';

const API_URL = 'http://localhost:3000/api';

const webhook: WebhookView = {
  id: 'wh_1',
  name: 'Deploy notifications',
  channelId: '234567890123456789',
  channelLabel: '#deployments',
  serverId: '123456789012345678',
  serverLabel: 'MicroClub',
  usageCount: 1234,
  lastUsedLabel: 'Aug 15, 2026, 9:30 AM',
  createdAtLabel: 'Aug 1, 2026, 10:00 AM',
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function toasts() {
  return useToastStore.getState().toasts;
}

afterEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('WebhookDetail', () => {
  it('shows the usage stats and where the webhook posts', () => {
    render(<WebhookDetail webhook={webhook} onDeleted={vi.fn()} />, { wrapper });

    expect(screen.getByRole('heading', { name: 'Deploy notifications' })).toBeInTheDocument();
    expect(screen.getByText((1234).toLocaleString())).toBeInTheDocument();
    expect(screen.getByText('Aug 15, 2026, 9:30 AM')).toBeInTheDocument();
    expect(screen.getByText('#deployments')).toBeInTheDocument();
    expect(screen.getByText('MicroClub')).toBeInTheDocument();
  });

  it('asks for confirmation and sends nothing when cancelled', async () => {
    const deleted = vi.fn();
    server.use(
      http.delete(`${API_URL}/admin/webhooks/wh_1`, () => {
        deleted();
        return new HttpResponse(null, { status: 204 });
      })
    );
    render(<WebhookDetail webhook={webhook} onDeleted={vi.fn()} />, { wrapper });

    await userEvent.click(screen.getByRole('button', { name: 'Delete webhook' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Deploy notifications');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleted).not.toHaveBeenCalled();
  });

  it('deletes on confirmation, then reports success', async () => {
    const onDeleted = vi.fn();
    server.use(
      http.delete(`${API_URL}/admin/webhooks/wh_1`, () => new HttpResponse(null, { status: 204 }))
    );
    render(<WebhookDetail webhook={webhook} onDeleted={onDeleted} />, { wrapper });

    await userEvent.click(screen.getByRole('button', { name: 'Delete webhook' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(toasts()).toEqual([
      expect.objectContaining({ variant: 'success', message: 'Webhook deleted' }),
    ]);
  });

  it('keeps the webhook and shows the API error when the delete fails', async () => {
    const onDeleted = vi.fn();
    server.use(
      http.delete(`${API_URL}/admin/webhooks/wh_1`, () =>
        HttpResponse.json(
          { statusCode: 502, message: 'Failed to delete webhook on Discord' },
          { status: 502 }
        )
      )
    );
    render(<WebhookDetail webhook={webhook} onDeleted={onDeleted} />, { wrapper });

    await userEvent.click(screen.getByRole('button', { name: 'Delete webhook' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(toasts()).toEqual([
        expect.objectContaining({
          variant: 'error',
          message: 'Failed to delete webhook on Discord',
        }),
      ])
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
