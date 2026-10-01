import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

vi.mock('@/features/auth/components/LogoutButton', () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}));

import { DashboardShell } from '@/shared/components/layout/dashboard-shell';

describe('DashboardShell', () => {
  it('renders children within the main landmark', () => {
    render(
      <DashboardShell>
        <div>page content</div>
      </DashboardShell>
    );

    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('opens the sidebar when the mobile menu button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <DashboardShell>
        <div>page content</div>
      </DashboardShell>
    );

    const toggle = screen.getByRole('button', { name: /open sidebar/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('returns focus to the menu toggle when the sidebar closes', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <DashboardShell>
        <div>page content</div>
      </DashboardShell>
    );

    const toggle = screen.getByRole('button', { name: /open sidebar/i });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: /close sidebar/i }));

    expect(toggle).toHaveFocus();
  });
});
