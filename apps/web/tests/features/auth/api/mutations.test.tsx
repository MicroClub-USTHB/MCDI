import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

import { ROOT_PERMISSIONS } from '../../../helpers/auth';

const replace = vi.fn();
const logoutAdminMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

vi.mock('@/features/auth/api/service', () => ({
  logoutAdmin: () => logoutAdminMock(),
}));

const mockUser = {
  id: '1',
  username: 'admin',
  name: 'Admin',
  email: 'admin@mcdi.dev',
  avatar: null,
  isSystemAdmin: true,
  root: true,
  permissions: ROOT_PERMISSIONS,
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function authenticate() {
  const { useAuthStore } = await import('@/features/auth/stores/auth');
  useAuthStore.setState({
    user: mockUser,
    sessionExpiresAt: '2026-08-07T10:00:00.000Z',
    isAuthenticated: true,
  });
  return useAuthStore;
}

describe('useLogoutMutation', () => {
  beforeEach(() => {
    replace.mockClear();
    logoutAdminMock.mockReset();
  });

  it('calls the backend, clears local auth, and returns to /login', async () => {
    logoutAdminMock.mockResolvedValue({ data: { success: true }, status: 200 });
    const useAuthStore = await authenticate();
    const { useLogoutMutation } = await import('@/features/auth/api/mutations');

    const { result } = renderHook(() => useLogoutMutation(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
    expect(logoutAdminMock).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('still logs out locally when the backend call fails', async () => {
    // Offline, or a session the server already considers dead — either way
    // the admin asked to leave, so the client session must not survive.
    logoutAdminMock.mockRejectedValue({ message: 'nope', code: 'UNAUTHORIZED', status: 401 });
    const useAuthStore = await authenticate();
    const { useLogoutMutation } = await import('@/features/auth/api/mutations');

    const { result } = renderHook(() => useLogoutMutation(), { wrapper });
    result.current.mutate();

    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false));
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
