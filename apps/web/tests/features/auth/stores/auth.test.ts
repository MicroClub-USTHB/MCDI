import { describe, it, expect, beforeEach } from 'vitest';

const mockUser = {
  id: '1',
  username: 'admin',
  name: 'Admin',
  email: 'admin@mcdi.dev',
  avatar: null,
  isSystemAdmin: true,
};

const EXPIRES_AT = '2026-08-07T10:00:00.000Z';

function clearCookies() {
  document.cookie = 'auth-token=; path=/; max-age=0';
}

describe('useAuthStore cookie sync', () => {
  beforeEach(async () => {
    clearCookies();
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.setState({ user: null, sessionExpiresAt: null, isAuthenticated: false });
  });

  it('sets the auth-token presence cookie on setAuth', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.getState().setAuth(mockUser, EXPIRES_AT);

    expect(document.cookie).toContain('auth-token=1');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().sessionExpiresAt).toBe(EXPIRES_AT);
  });

  it('clears the auth-token cookie and every trace of the session on clearAuth', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.getState().setAuth(mockUser, EXPIRES_AT);
    useAuthStore.getState().clearAuth();

    expect(document.cookie).not.toContain('auth-token=1');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().sessionExpiresAt).toBeNull();
  });

  it('never stores a session token — the real session is an httpOnly cookie', async () => {
    const { useAuthStore } = await import('@/features/auth/stores/auth');
    useAuthStore.getState().setAuth(mockUser, EXPIRES_AT);

    expect(JSON.stringify(useAuthStore.getState())).not.toMatch(/token/i);
  });
});
