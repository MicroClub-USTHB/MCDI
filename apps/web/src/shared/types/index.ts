/**
 * The backend returns resource bodies verbatim — there is no envelope on the
 * wire. `ApiClient` wraps every response in this shape so callers have one
 * contract to consume; `message` is only populated by endpoints that send one.
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface User {
  id: string;
  username: string;
  /** `displayName` → `globalName` → `username`, whichever the admin has set. */
  name: string;
  email: string | null;
  avatar: string | null;
  isSystemAdmin: boolean;
}

/**
 * No tokens here on purpose: the session is an httpOnly cookie owned by the
 * backend, so the browser can never read it. This store holds only what the
 * UI renders plus a hydration flag; `isAuthenticated` means "the last
 * `/auth/admin/me` call succeeded", not "a token exists".
 */
export interface AuthState {
  user: User | null;
  /** ISO timestamp from `/auth/admin/me`; informational only. */
  sessionExpiresAt: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setAuth: (user: User, sessionExpiresAt?: string | null) => void;
  clearAuth: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}
