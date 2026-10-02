import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type * as SyncModule from '@/features/sync';

const useServersQuery = vi.fn();
const useProjectsQuery = vi.fn();
const useMemberStatsQuery = vi.fn();
const useSyncStatusAllQuery = vi.fn();

vi.mock('@/features/servers', () => ({ useServersQuery: () => useServersQuery() }));
vi.mock('@/features/projects', () => ({ useProjectsQuery: () => useProjectsQuery() }));
vi.mock('@/features/stats', () => ({ useMemberStatsQuery: () => useMemberStatsQuery() }));
vi.mock('@/features/sync', async () => {
  const actual = await vi.importActual<typeof SyncModule>('@/features/sync');
  return {
    ...actual,
    useSyncStatusAllQuery: () => useSyncStatusAllQuery(),
  };
});

import { QuickStats } from '@/app/dashboard/quick-stats';

const pendingResult = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };

describe('QuickStats', () => {
  it('renders a skeleton for each card while loading', () => {
    useServersQuery.mockReturnValue(pendingResult);
    useProjectsQuery.mockReturnValue(pendingResult);
    useMemberStatsQuery.mockReturnValue(pendingResult);
    useSyncStatusAllQuery.mockReturnValue(pendingResult);

    const { container } = render(<QuickStats />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('wraps the grid in a polite live region so state changes are announced', () => {
    useServersQuery.mockReturnValue(pendingResult);
    useProjectsQuery.mockReturnValue(pendingResult);
    useMemberStatsQuery.mockReturnValue(pendingResult);
    useSyncStatusAllQuery.mockReturnValue(pendingResult);

    const { container } = render(<QuickStats />);
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
  });

  it('renders real values once every query succeeds', () => {
    useServersQuery.mockReturnValue({
      data: [{ id: '1' }, { id: '2' }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useProjectsQuery.mockReturnValue({
      data: [{ id: 'a' }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useMemberStatsQuery.mockReturnValue({
      data: { totalMembers: 1247, newMembersThisPeriod: 12, growthRate: 4.2 },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useSyncStatusAllQuery.mockReturnValue({
      data: [{ status: 'success' }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<QuickStats />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('1,247')).toBeInTheDocument();
    expect(screen.getByText('All synced')).toBeInTheDocument();
  });

  it('shows a retry control for a card whose query failed, independent of the others', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const refetch = vi.fn();

    useServersQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    useProjectsQuery.mockReturnValue({
      data: [{ id: 'a' }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    useMemberStatsQuery.mockReturnValue(pendingResult);
    useSyncStatusAllQuery.mockReturnValue(pendingResult);

    render(<QuickStats />);

    expect(screen.getByText('1')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);
    expect(refetch).toHaveBeenCalledOnce();
  });
});
