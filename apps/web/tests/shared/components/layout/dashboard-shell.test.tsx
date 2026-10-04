import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

vi.mock('@/features/auth/components/LogoutButton', () => ({
  LogoutButton: () => <button type="button">Log out</button>,
}));

import { DashboardShell } from '@/shared/components/layout/dashboard-shell';

describe('DashboardShell', () => {
  it('renders children within the main landmark', () => {
    render(
      <DashboardShell>
        <div>page content</div>
      </DashboardShell>,
      { wrapper }
    );

    expect(screen.getByRole('main')).toHaveTextContent('page content');
  });

  it('positions the scrolling main, so form controls cannot stretch the page', () => {
    render(
      <DashboardShell>
        <div>page content</div>
      </DashboardShell>,
      { wrapper }
    );

    // Radix renders a hidden absolutely positioned input beside each checkbox and switch
    // in a form. Without a positioned ancestor those escape the shell's overflow and
    // make the whole window scroll.
    expect(screen.getByRole('main')).toHaveClass('relative', 'overflow-y-auto');
  });

  it('opens the sidebar when the mobile menu button is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    render(
      <DashboardShell>
        <div>page content</div>
      </DashboardShell>,
      { wrapper }
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
      </DashboardShell>,
      { wrapper }
    );

    const toggle = screen.getByRole('button', { name: /open sidebar/i });
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: /close sidebar/i }));

    expect(toggle).toHaveFocus();
  });
});
