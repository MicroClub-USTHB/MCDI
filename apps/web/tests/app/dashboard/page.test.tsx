import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/app/dashboard/quick-stats', () => ({
  QuickStats: () => <div>quick stats</div>,
}));

import DashboardPage from '@/app/dashboard/page';

describe('DashboardPage', () => {
  it('renders the page heading and the quick stats section', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('quick stats')).toBeInTheDocument();
  });
});
