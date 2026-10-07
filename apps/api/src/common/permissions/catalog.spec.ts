import {
  ACCESS_LEVELS,
  ACCESS_RESOURCES,
  GRANT_LEVELS,
  LEVEL_DESCRIPTIONS,
  RESOURCE_DESCRIPTIONS,
  isAccessLevel,
  isAccessResource,
  isGrantLevel,
  levelAtLeast,
} from './catalog';

describe('catalog', () => {
  it('lists the 14 resources from the design, in snake case', () => {
    expect([...ACCESS_RESOURCES]).toEqual([
      'servers',
      'members',
      'channels',
      'messages',
      'roles',
      'projects',
      'project_keys',
      'webhooks',
      'inbound_webhooks',
      'sync',
      'stats',
      'audit',
      'monitoring',
      'settings',
    ]);
  });

  it('orders the levels none, read, write, manage', () => {
    expect([...ACCESS_LEVELS]).toEqual(['none', 'read', 'write', 'manage']);
    expect([...GRANT_LEVELS]).toEqual(['read', 'write', 'manage']);
  });

  it('describes every resource and every level', () => {
    for (const resource of ACCESS_RESOURCES) {
      expect(RESOURCE_DESCRIPTIONS[resource].length).toBeGreaterThan(10);
    }
    for (const level of ACCESS_LEVELS) {
      expect(LEVEL_DESCRIPTIONS[level].length).toBeGreaterThan(3);
    }
  });

  describe('levelAtLeast', () => {
    it.each([
      ['manage', 'manage', true],
      ['manage', 'write', true],
      ['manage', 'read', true],
      ['write', 'read', true],
      ['write', 'write', true],
      ['write', 'manage', false],
      ['read', 'write', false],
      ['read', 'read', true],
      ['none', 'read', false],
      ['none', 'none', true],
    ] as const)('%s against required %s is %s', (effective, required, expected) => {
      expect(levelAtLeast(effective, required)).toBe(expected);
    });
  });

  describe('type guards', () => {
    it('accepts only known resources', () => {
      expect(isAccessResource('members')).toBe(true);
      expect(isAccessResource('nope')).toBe(false);
      expect(isAccessResource(42)).toBe(false);
    });

    it('accepts none only as an access level, never as a grant level', () => {
      expect(isAccessLevel('none')).toBe(true);
      expect(isGrantLevel('none')).toBe(false);
      expect(isGrantLevel('manage')).toBe(true);
      expect(isAccessLevel('admin')).toBe(false);
    });
  });
});
