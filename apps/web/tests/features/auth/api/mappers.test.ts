import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, it, expect } from 'vitest';
import { mapAdminProfileToUser } from '@/features/auth/api/mappers';
import type { AdminProfileDto } from '@/features/auth/types';
import type { Permissions } from '@/shared/lib/access';

const permissions = Object.fromEntries(
  ACCESS_RESOURCES.map((resource) => [resource, resource === 'members' ? 'read' : 'none'])
) as Permissions;

const baseProfile: AdminProfileDto = {
  id: '42',
  username: 'clubadmin',
  globalName: 'Club Admin',
  displayName: 'Prez',
  avatar: 'a1b2c3',
  email: 'admin@mcdi.dev',
  isSystemAdmin: true,
  sessionExpiresAt: '2026-08-07T10:00:00.000Z',
  root: false,
  permissions,
};

describe('mapAdminProfileToUser', () => {
  it('maps the raw admin profile DTO to the shared User shape', () => {
    expect(mapAdminProfileToUser(baseProfile)).toEqual({
      id: '42',
      username: 'clubadmin',
      name: 'Prez',
      email: 'admin@mcdi.dev',
      avatar: 'a1b2c3',
      isSystemAdmin: true,
      root: false,
      permissions,
    });
  });

  it('carries root and the permissions map onto the user', () => {
    const user = mapAdminProfileToUser(baseProfile);

    expect(user.root).toBe(false);
    expect(user.permissions.members).toBe('read');
    expect(user.permissions.messages).toBe('none');
  });

  it('falls back to globalName when the member has no server display name', () => {
    expect(mapAdminProfileToUser({ ...baseProfile, displayName: null }).name).toBe('Club Admin');
  });

  it('falls back to username when both display names are unset', () => {
    expect(
      mapAdminProfileToUser({ ...baseProfile, displayName: null, globalName: null }).name
    ).toBe('clubadmin');
  });

  it('preserves the nullable columns rather than coercing them to empty strings', () => {
    const user = mapAdminProfileToUser({ ...baseProfile, email: null, avatar: null });

    expect(user.email).toBeNull();
    expect(user.avatar).toBeNull();
  });
});
