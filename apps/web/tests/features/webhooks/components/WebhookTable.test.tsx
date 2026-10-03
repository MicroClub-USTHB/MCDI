import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WebhookTable } from '@/features/webhooks/components';
import type { WebhookView } from '@/features/webhooks';

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

describe('WebhookTable', () => {
  it('shows name, channel, server, usage count and last used', () => {
    render(<WebhookTable webhooks={[webhook]} selectedId={null} onSelect={vi.fn()} />);

    const row = screen.getByRole('row', { name: /Deploy notifications/ });
    expect(within(row).getByText('#deployments')).toBeInTheDocument();
    expect(within(row).getByText('MicroClub')).toBeInTheDocument();
    expect(within(row).getByText((1234).toLocaleString())).toBeInTheDocument();
    expect(within(row).getByText('Aug 15, 2026, 9:30 AM')).toBeInTheDocument();
  });

  it('selects a webhook from its name, which keyboard users can reach', async () => {
    const onSelect = vi.fn();
    render(<WebhookTable webhooks={[webhook]} selectedId={null} onSelect={onSelect} />);

    const button = screen.getByRole('button', { name: 'Deploy notifications' });
    button.focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('wh_1');
  });

  it('marks the selected webhook', () => {
    render(<WebhookTable webhooks={[webhook]} selectedId="wh_1" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Deploy notifications' })).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  it('renders the empty state when there are no webhooks', () => {
    render(
      <WebhookTable
        webhooks={[]}
        selectedId={null}
        onSelect={vi.fn()}
        emptyState={<p>No webhooks</p>}
      />
    );

    expect(screen.getByText('No webhooks')).toBeInTheDocument();
  });
});
