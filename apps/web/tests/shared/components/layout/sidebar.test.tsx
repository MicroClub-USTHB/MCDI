import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/members',
}));

vi.mock('@/features/auth/components/LogoutButton', () => ({
  LogoutButton: () => (
    <button type="button" aria-label="Log out">
      Log out
    </button>
  ),
}));

import { Sidebar } from '@/shared/components/layout/sidebar';
import { useAuthStore } from '@/features/auth/stores/auth';

describe('Sidebar', () => {
  it('renders every feature nav item', () => {
    render(<Sidebar open onClose={() => {}} />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /members/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /servers/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
  });

  it('marks the item matching the current route as the current page', () => {
    render(<Sidebar open onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /members/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /^dashboard$/i })).not.toHaveAttribute('aria-current');
  });

  it('calls onClose when the mobile close button is clicked', async () => {
    const onClose = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<Sidebar open onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /close sidebar/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const { container } = render(<Sidebar open onClose={onClose} />);

    const backdrop = container.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).not.toBeNull();
    await userEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed while open', async () => {
    const onClose = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    render(<Sidebar open onClose={onClose} />);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('moves focus to the close button when it opens', () => {
    render(<Sidebar open onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /close sidebar/i })).toHaveFocus();
  });

  describe('account footer', () => {
    afterEach(() => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
    });

    it('is omitted when no user is signed in', () => {
      useAuthStore.setState({ user: null });
      render(<Sidebar open onClose={() => {}} />);
      expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
    });

    it('shows the signed-in user and a logout control', () => {
      useAuthStore.setState({
        user: {
          id: '1',
          username: 'dev_user',
          name: 'Dev User',
          email: 'dev@example.com',
          avatar: null,
          isSystemAdmin: true,
        },
      });
      render(<Sidebar open onClose={() => {}} />);

      expect(screen.getByText('Dev User')).toBeInTheDocument();
      expect(screen.getByText('dev@example.com')).toBeInTheDocument();
      expect(screen.getByText('DU')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });
  });
});
