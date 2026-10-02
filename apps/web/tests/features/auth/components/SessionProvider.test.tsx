import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const replace = vi.fn();
const useCurrentAdminQueryMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('@/features/auth/api/queries', () => ({
  useCurrentAdminQuery: () => useCurrentAdminQueryMock(),
}));

const mockUser = {
  id: '1',
  username: 'admin',
  name: 'Admin',
  email: 'admin@mcdi.dev',
  avatar: null,
  isSystemAdmin: true,
};

const EXPIRES_AT = '2026-08-07T10:00:00.000Z';

describe('SessionProvider', () => {
  beforeEach(async () => {
    replace.mockClear();
    useCurrentAdminQueryMock.mockReset();
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({
      user: null,
      sessionExpiresAt: null,
      isAuthenticated: false,
      hasHydrated: true,
    });
    const { useToastStore } = await import('@/shared/stores/toast');
    useToastStore.setState({ toasts: [] });
  });

  it('renders children without side effects while the session is valid', async () => {
    useCurrentAdminQueryMock.mockReturnValue({ data: undefined, isError: false });
    const { SessionProvider } = await import('@/features/auth/components/SessionProvider');

    render(
      <SessionProvider>
        <div>app content</div>
      </SessionProvider>
    );

    expect(screen.getByText('app content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('refreshes the stored profile and expiry when the session query resolves', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({ user: mockUser, sessionExpiresAt: null, isAuthenticated: true });
    const updatedUser = { ...mockUser, name: 'Updated Admin' };
    useCurrentAdminQueryMock.mockReturnValue({
      data: { user: updatedUser, sessionExpiresAt: EXPIRES_AT },
      isError: false,
    });
    const { SessionProvider } = await import('@/features/auth/components/SessionProvider');

    render(
      <SessionProvider>
        <div>app content</div>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });
    expect(useAuthStore.getState().sessionExpiresAt).toBe(EXPIRES_AT);
  });

  it('clears auth, toasts, and redirects to /login when the session query errors while authenticated', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({
      user: mockUser,
      sessionExpiresAt: EXPIRES_AT,
      isAuthenticated: true,
    });
    useCurrentAdminQueryMock.mockReturnValue({ data: undefined, isError: true });
    const { SessionProvider } = await import('@/features/auth/components/SessionProvider');
    const { useToastStore } = await import('@/shared/stores/toast');

    render(
      <SessionProvider>
        <div>app content</div>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
    expect(replace).toHaveBeenCalledWith('/login');
    expect(useToastStore.getState().toasts.some((toast) => toast.variant === 'warning')).toBe(true);
  });
});
