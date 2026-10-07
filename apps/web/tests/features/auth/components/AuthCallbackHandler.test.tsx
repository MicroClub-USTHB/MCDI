import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ROOT_PERMISSIONS } from '../../../helpers/auth';

const replace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParams,
}));

const fetchCurrentAdminMock = vi.fn();
const consumePostLoginRedirectMock = vi.fn(() => '/dashboard');

vi.mock('@/features/auth/api/service', () => ({
  fetchCurrentAdmin: () => fetchCurrentAdminMock(),
  consumePostLoginRedirect: () => consumePostLoginRedirectMock(),
}));

const mockProfile = {
  id: '1',
  username: 'admin',
  globalName: null,
  displayName: 'Prez',
  avatar: null,
  email: 'admin@mcdi.dev',
  isSystemAdmin: true,
  sessionExpiresAt: '2026-08-07T10:00:00.000Z',
  root: true,
  permissions: ROOT_PERMISSIONS,
};

describe('AuthCallbackHandler', () => {
  beforeEach(async () => {
    replace.mockClear();
    fetchCurrentAdminMock.mockReset();
    consumePostLoginRedirectMock.mockClear();
    consumePostLoginRedirectMock.mockReturnValue('/dashboard');
    searchParams = new URLSearchParams();
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({ user: null, sessionExpiresAt: null, isAuthenticated: false });
  });

  it('confirms the cookie session via /auth/admin/me and redirects to the stashed path', async () => {
    consumePostLoginRedirectMock.mockReturnValue('/dashboard/servers');
    fetchCurrentAdminMock.mockResolvedValue({ data: mockProfile, status: 200 });
    const { AuthCallbackHandler } = await import('@/features/auth/components/AuthCallbackHandler');
    const { useAuthStore } = await import('@/features/auth/stores/auth');

    render(<AuthCallbackHandler />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/servers'));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual({
      id: '1',
      username: 'admin',
      name: 'Prez',
      email: 'admin@mcdi.dev',
      avatar: null,
      isSystemAdmin: true,
      root: true,
      permissions: ROOT_PERMISSIONS,
    });
    expect(useAuthStore.getState().sessionExpiresAt).toBe('2026-08-07T10:00:00.000Z');
  });

  it('shows Access Denied when the backend rejects a member lacking the admin role', async () => {
    searchParams.set(
      'error',
      'Only members with a configured admin role can access the admin panel'
    );
    const { AuthCallbackHandler } = await import('@/features/auth/components/AuthCallbackHandler');

    render(<AuthCallbackHandler />);

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
    expect(fetchCurrentAdminMock).not.toHaveBeenCalled();
  });

  it('shows Access Denied when the member is not in the main guild', async () => {
    searchParams.set(
      'error',
      'You must be a member of the main MCDI Discord server to access the admin panel'
    );
    const { AuthCallbackHandler } = await import('@/features/auth/components/AuthCallbackHandler');

    render(<AuthCallbackHandler />);

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
  });

  it('shows Access Denied when the profile fetch itself comes back 403', async () => {
    fetchCurrentAdminMock.mockRejectedValue({
      message: 'Forbidden',
      code: 'FORBIDDEN',
      status: 403,
    });
    const { AuthCallbackHandler } = await import('@/features/auth/components/AuthCallbackHandler');

    render(<AuthCallbackHandler />);

    expect(await screen.findByText('Access Denied')).toBeInTheDocument();
  });

  it('surfaces a server misconfiguration as a generic failure, not Access Denied', async () => {
    // The admin's Discord roles are not the problem here — pointing them at
    // their role would send them chasing the wrong fix.
    searchParams.set('error', 'Server configuration error: main guild not set');
    const { AuthCallbackHandler } = await import('@/features/auth/components/AuthCallbackHandler');

    render(<AuthCallbackHandler />);

    expect(await screen.findByRole('link', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    expect(screen.getByText('Server configuration error: main guild not set')).toBeInTheDocument();
  });

  it('shows a generic error and clears local auth when the profile fetch fails', async () => {
    fetchCurrentAdminMock.mockRejectedValue({ message: 'boom', code: 'UNAUTHORIZED', status: 401 });
    const { AuthCallbackHandler } = await import('@/features/auth/components/AuthCallbackHandler');
    const { useAuthStore } = await import('@/features/auth/stores/auth');

    render(<AuthCallbackHandler />);

    expect(await screen.findByRole('link', { name: /retry/i })).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('shows the connecting state while the profile fetch is in flight', async () => {
    fetchCurrentAdminMock.mockReturnValue(new Promise(() => {}));
    const { AuthCallbackHandler } = await import('@/features/auth/components/AuthCallbackHandler');

    render(<AuthCallbackHandler />);

    expect(screen.getByRole('status')).toHaveTextContent(/connecting to discord/i);
  });
});
