import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SyncChangeDetail } from '@/features/sync/components';
import type { SyncChangeEntry } from '@/features/sync/api/mappers';

function change(overrides: Partial<SyncChangeEntry> = {}): SyncChangeEntry {
  return {
    id: 1,
    entityType: 'member',
    entityId: '987654321098765432',
    action: 'added',
    tone: 'success',
    description: null,
    details: null,
    createdAt: '2026-08-28T09:59:05.000Z',
    ...overrides,
  };
}

type Props = Parameters<typeof SyncChangeDetail>[0];

function renderDetail(props: Partial<Props> = {}) {
  const merged: Props = {
    changes: [],
    page: 1,
    pageSize: 100,
    total: props.changes?.length ?? 0,
    totalPages: 1,
    onPageChange: vi.fn(),
    ...props,
  };
  return { onPageChange: merged.onPageChange, ...render(<SyncChangeDetail {...merged} />) };
}

describe('SyncChangeDetail', () => {
  it('shows a skeleton while loading', () => {
    const { container } = renderDetail({ isLoading: true });
    expect(
      container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length
    ).toBeGreaterThan(0);
  });

  it('shows an empty message when there are no changes', () => {
    renderDetail();
    expect(screen.getByText('No changes were recorded for this sync.')).toBeInTheDocument();
  });

  it('renders the action label, description, and details for each change', () => {
    renderDetail({
      changes: [
        change({ id: 1, action: 'role_assigned', description: 'Granted Moderator' }),
        change({ id: 2, action: 'updated', description: null, details: '{"nick":"x"}' }),
      ],
    });

    expect(screen.getByText('role assigned')).toBeInTheDocument();
    expect(screen.getByText('Granted Moderator')).toBeInTheDocument();
    expect(screen.getByText('{"nick":"x"}')).toBeInTheDocument();
  });

  it('pages through change history when there is more than one window', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    renderDetail({
      changes: [change()],
      page: 1,
      pageSize: 100,
      total: 250,
      totalPages: 3,
      onPageChange,
    });

    expect(screen.getByText('1–100 of 250')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('hides pagination for a single window', () => {
    renderDetail({ changes: [change()], total: 1, totalPages: 1 });
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });
});
