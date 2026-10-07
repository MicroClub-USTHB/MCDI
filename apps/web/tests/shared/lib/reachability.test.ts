import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import type { Permissions } from '@/shared/lib/access';
import { describeUnreachable, unreachableGrants } from '@/shared/lib/reachability';

const levels = (granted: Partial<Permissions>): Permissions =>
  ({
    ...Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, 'none'])),
    ...granted,
  }) as Permissions;

describe('unreachableGrants', () => {
  it('finds nothing for a grant that has a page of its own', () => {
    expect(unreachableGrants(levels({ members: 'read', stats: 'read' }))).toEqual([]);
    expect(unreachableGrants(levels({ servers: 'read', sync: 'manage' }))).toEqual([]);
    expect(unreachableGrants(levels({ settings: 'read', audit: 'read' }))).toEqual([]);
  });

  it('flags a server-scoped grant without servers:read and names what is missing', () => {
    const result = unreachableGrants(levels({ channels: 'read' }));
    expect(result).toEqual([
      { resource: 'channels', missing: [{ resource: 'servers', level: 'read' }] },
    ]);
    expect(describeUnreachable(result[0]!)).toBe(
      'Channels needs Servers: read to be reachable in the panel'
    );
  });

  it('needs statistics as well as servers for roles', () => {
    const result = unreachableGrants(levels({ servers: 'read', roles: 'read' }));
    expect(result).toEqual([
      { resource: 'roles', missing: [{ resource: 'stats', level: 'read' }] },
    ]);
  });

  it('flags webhooks and project keys without projects:read', () => {
    const result = unreachableGrants(levels({ webhooks: 'read', project_keys: 'read' }));
    expect(result.map((entry) => entry.resource)).toEqual(['project_keys', 'webhooks']);
    expect(result.every((entry) => entry.missing.some((m) => m.resource === 'projects'))).toBe(
      true
    );
  });

  it('needs channels and servers for messages', () => {
    const result = unreachableGrants(levels({ messages: 'read' }));
    expect(result[0]?.resource).toBe('messages');
    expect(result[0]?.missing.map((m) => m.resource).sort()).toEqual(['channels', 'servers']);

    expect(
      unreachableGrants(levels({ messages: 'read', channels: 'read', servers: 'read' }))
    ).toEqual([]);
  });

  it('ignores resources the member holds nothing on', () => {
    expect(unreachableGrants(levels({}))).toEqual([]);
  });
});
