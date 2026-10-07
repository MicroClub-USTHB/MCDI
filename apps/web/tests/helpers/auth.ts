import { ACCESS_RESOURCES } from '@mcdi/contracts';

import type { AdminProfileDto } from '@/features/auth/types';
import { useAuthStore } from '@/features/auth/stores/auth';
import type { Permissions } from '@/shared/lib/access';
import type { User } from '@/shared/types';

export const NO_PERMISSIONS = Object.fromEntries(
  ACCESS_RESOURCES.map((resource) => [resource, 'none'])
) as Permissions;

export const ROOT_PERMISSIONS = Object.fromEntries(
  ACCESS_RESOURCES.map((resource) => [resource, 'manage'])
) as Permissions;

/** Every resource `none` except the ones given. */
export function permissionsWith(levels: Partial<Permissions>): Permissions {
  return { ...NO_PERMISSIONS, ...levels };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    username: 'ada',
    name: 'Ada',
    email: 'ada@example.com',
    avatar: null,
    isSystemAdmin: false,
    root: true,
    permissions: ROOT_PERMISSIONS,
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<AdminProfileDto> = {}): AdminProfileDto {
  return {
    id: '1',
    username: 'ada',
    globalName: null,
    displayName: 'Ada',
    avatar: null,
    email: 'ada@example.com',
    isSystemAdmin: false,
    sessionExpiresAt: '2026-10-08T00:00:00.000Z',
    root: true,
    permissions: ROOT_PERMISSIONS,
    ...overrides,
  };
}

/**
 * Signs a user in the store. Pass `permissions` for a member with limited access
 * (`root` is then false unless given). Does not touch `isAuthenticated` or
 * `hasHydrated`: tests that need those set them themselves.
 */
export function signInAs(options: { root?: boolean; permissions?: Partial<Permissions> } = {}) {
  const root = options.root ?? options.permissions === undefined;
  const permissions = root ? ROOT_PERMISSIONS : permissionsWith(options.permissions ?? {});
  useAuthStore.setState({ user: makeUser({ root, permissions }) });
}

export function signInAsRoot() {
  signInAs({ root: true });
}

export function signOut() {
  useAuthStore.setState({ user: null });
}
