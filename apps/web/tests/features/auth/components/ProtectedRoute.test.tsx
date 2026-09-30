import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard',
}));

describe('ProtectedRoute', () => {
  beforeEach(async () => {
    replace.mockClear();
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({
      user: null,
      sessionExpiresAt: null,
      isAuthenticated: false,
      hasHydrated: false,
    });
  });

  it('renders the fallback and does not redirect while the store is still hydrating', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({ hasHydrated: false, isAuthenticated: false });
    const { ProtectedRoute } = await import('@/features/auth/components/ProtectedRoute');

    render(
      <ProtectedRoute fallback={<div>loading session</div>}>
        <div>secret content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('loading session')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to /login with the current path once hydrated and unauthenticated', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({ hasHydrated: true, isAuthenticated: false });
    const { ProtectedRoute } = await import('@/features/auth/components/ProtectedRoute');

    render(
      <ProtectedRoute>
        <div>secret content</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login?redirect=%2Fdashboard');
  });

  it('renders children once hydrated and authenticated', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({ hasHydrated: true, isAuthenticated: true });
    const { ProtectedRoute } = await import('@/features/auth/components/ProtectedRoute');

    render(
      <ProtectedRoute>
        <div>secret content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('secret content')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
