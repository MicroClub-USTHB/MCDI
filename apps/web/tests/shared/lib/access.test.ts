import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import {
  ANY_ACCESS,
  OPEN,
  ROOT_ONLY,
  allOf,
  anyOf,
  canAccess,
  hasAnyAccess,
  levelOf,
  need,
  type AccessSubject,
  type Permissions,
} from '@/shared/lib/access';
import { describeRequirement } from '@/shared/lib/access-labels';

const none = Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, 'none'])) as Permissions;

function subject(permissions: Partial<Permissions> = {}, root = false): AccessSubject {
  return { root, permissions: { ...none, ...permissions } };
}

describe('levelOf', () => {
  it('is none for a signed-out visitor and for a missing resource', () => {
    expect(levelOf(null, 'members')).toBe('none');
    expect(levelOf({ root: false, permissions: {} as Permissions }, 'members')).toBe('none');
  });

  it('is manage everywhere for root, whatever the map says', () => {
    expect(levelOf(subject({}, true), 'messages')).toBe('manage');
  });
});

describe('hasAnyAccess', () => {
  it('is false with every level none, true with one above none, true for root', () => {
    expect(hasAnyAccess(null)).toBe(false);
    expect(hasAnyAccess(subject())).toBe(false);
    expect(hasAnyAccess(subject({ stats: 'read' }))).toBe(true);
    expect(hasAnyAccess(subject({}, true))).toBe(true);
  });
});

describe('canAccess', () => {
  it('refuses a signed-out visitor, even an open route', () => {
    expect(canAccess(null, OPEN)).toBe(false);
  });

  it('lets any signed-in admin through an open route', () => {
    expect(canAccess(subject(), OPEN)).toBe(true);
  });

  it('applies cumulative levels', () => {
    const manager = subject({ projects: 'manage' });
    expect(canAccess(manager, need('projects', 'read'))).toBe(true);
    expect(canAccess(manager, need('projects', 'write'))).toBe(true);
    expect(canAccess(manager, need('projects', 'manage'))).toBe(true);

    const writer = subject({ projects: 'write' });
    expect(canAccess(writer, need('projects', 'write'))).toBe(true);
    expect(canAccess(writer, need('projects', 'manage'))).toBe(false);

    expect(canAccess(subject({ projects: 'read' }), need('projects', 'write'))).toBe(false);
    expect(canAccess(subject(), need('projects', 'read'))).toBe(false);
  });

  it('lets root pass everything, including root-only', () => {
    const root = subject({}, true);
    expect(canAccess(root, ROOT_ONLY)).toBe(true);
    expect(canAccess(root, need('messages', 'manage'))).toBe(true);
    expect(canAccess(subject({ settings: 'manage' }), ROOT_ONLY)).toBe(false);
  });

  it('handles all of and any of', () => {
    const both = allOf(need('servers', 'read'), need('roles', 'read'));
    expect(canAccess(subject({ servers: 'read', roles: 'read' }), both)).toBe(true);
    expect(canAccess(subject({ servers: 'read' }), both)).toBe(false);

    const either = anyOf(need('monitoring', 'read'), need('audit', 'read'));
    expect(canAccess(subject({ audit: 'read' }), either)).toBe(true);
    expect(canAccess(subject(), either)).toBe(false);
  });

  it('handles anyAccess', () => {
    expect(canAccess(subject(), ANY_ACCESS)).toBe(false);
    expect(canAccess(subject({ sync: 'read' }), ANY_ACCESS)).toBe(true);
  });
});

describe('describeRequirement', () => {
  it('names the resource and level in words', () => {
    expect(describeRequirement(need('project_keys', 'write'))).toBe('Project API keys: write');
    expect(describeRequirement(ROOT_ONLY)).toBe('Root access');
    expect(describeRequirement(allOf(need('servers', 'read'), need('roles', 'read')))).toBe(
      'Servers: read and Roles: read'
    );
    expect(describeRequirement(anyOf(need('monitoring', 'read'), need('audit', 'read')))).toBe(
      'Monitoring: read or Audit log: read'
    );
    expect(describeRequirement(ANY_ACCESS)).toBe('Access to at least one area');
  });
});
