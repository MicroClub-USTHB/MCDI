import { ACCESS_RESOURCES } from './catalog';
import { resolveEffectiveAccess } from './resolve-access';

describe('resolveEffectiveAccess', () => {
  it('gives root manage on every resource, ignoring grants and overrides', () => {
    const access = resolveEffectiveAccess({
      isRoot: true,
      roleGrants: [],
      overrides: [{ resource: 'members', level: 'none' }],
    });

    for (const resource of ACCESS_RESOURCES) {
      expect(access[resource]).toEqual({
        level: 'manage',
        source: { type: 'root' },
      });
    }
  });

  it('gives nothing to a member with no roles and no overrides', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [],
      overrides: [],
    });

    for (const resource of ACCESS_RESOURCES) {
      expect(access[resource]).toEqual({ level: 'none', source: { type: 'none' } });
    }
  });

  it('takes the highest level across several roles and names the role that supplied it', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [
        { roleId: 'r-hr', resource: 'members', level: 'read' },
        { roleId: 'r-dev', resource: 'members', level: 'write' },
        { roleId: 'r-hr', resource: 'audit', level: 'read' },
      ],
      overrides: [],
    });

    expect(access.members).toEqual({
      level: 'write',
      source: { type: 'role', roleId: 'r-dev' },
    });
    expect(access.audit).toEqual({
      level: 'read',
      source: { type: 'role', roleId: 'r-hr' },
    });
    expect(access.messages.level).toBe('none');
  });

  it('lets an override raise a level above the roles', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [{ roleId: 'r-dev', resource: 'projects', level: 'read' }],
      overrides: [{ resource: 'projects', level: 'manage' }],
    });

    expect(access.projects).toEqual({
      level: 'manage',
      source: { type: 'override' },
    });
  });

  it('lets an override lower a level below the roles', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [{ roleId: 'r-dev', resource: 'projects', level: 'manage' }],
      overrides: [{ resource: 'projects', level: 'read' }],
    });

    expect(access.projects.level).toBe('read');
  });

  it('lets an override of none deny what a role grants, for that resource only', () => {
    const access = resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [
        { roleId: 'r-dev', resource: 'messages', level: 'read' },
        { roleId: 'r-dev', resource: 'channels', level: 'read' },
      ],
      overrides: [{ resource: 'messages', level: 'none' }],
    });

    expect(access.messages).toEqual({ level: 'none', source: { type: 'override' } });
    expect(access.channels.level).toBe('read');
  });
});
