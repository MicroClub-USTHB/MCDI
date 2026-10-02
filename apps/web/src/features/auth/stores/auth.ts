import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User } from '@/shared/types';
import { clearAuthCookie, setAuthCookie } from '@/shared/lib/cookies';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionExpiresAt: null,
      isAuthenticated: false,
      hasHydrated: false,

      // Only ever called after `/auth/admin/me` has come back 200, which is
      // what makes it safe to set the middleware-trusted cookie here: the
      // backend has confirmed the session cookie is real and carries an
      // admin role. Nothing on the client can reach this state by guessing.
      setAuth: (user: User, sessionExpiresAt: string | null = null) => {
        setAuthCookie();
        set({ user, sessionExpiresAt, isAuthenticated: true });
      },

      clearAuth: () => {
        clearAuthCookie();
        set({ user: null, sessionExpiresAt: null, isAuthenticated: false });
      },

      setHasHydrated: (hasHydrated: boolean) => {
        set({ hasHydrated });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        sessionExpiresAt: state.sessionExpiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated) {
          setAuthCookie();
        } else {
          clearAuthCookie();
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
