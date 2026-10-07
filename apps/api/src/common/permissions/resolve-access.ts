import {
  ACCESS_RESOURCES,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from './catalog';

export type AccessSource =
  | { type: 'root' }
  | { type: 'override' }
  | { type: 'role'; roleId: string }
  | { type: 'none' };

export interface EffectiveEntry {
  level: AccessLevel;
  source: AccessSource;
}

export type EffectiveAccess = Record<AccessResource, EffectiveEntry>;

export interface RoleGrant {
  roleId: string;
  resource: AccessResource;
  level: GrantLevel;
}

export interface MemberOverride {
  resource: AccessResource;
  level: AccessLevel;
}

/**
 * Per resource: root wins, then a member override is final (it may raise,
 * lower or deny), then the highest level across the member's role grants.
 */
export function resolveEffectiveAccess(input: {
  isRoot: boolean;
  roleGrants: RoleGrant[];
  overrides: MemberOverride[];
}): EffectiveAccess {
  const overrides = new Map<AccessResource, AccessLevel>(
    input.overrides.map((o) => [o.resource, o.level]),
  );
  const result = {} as EffectiveAccess;

  for (const resource of ACCESS_RESOURCES) {
    if (input.isRoot) {
      result[resource] = { level: 'manage', source: { type: 'root' } };
      continue;
    }

    const override = overrides.get(resource);
    if (override !== undefined) {
      result[resource] = { level: override, source: { type: 'override' } };
      continue;
    }

    let best: EffectiveEntry = { level: 'none', source: { type: 'none' } };
    for (const grant of input.roleGrants) {
      if (grant.resource === resource && !levelAtLeast(best.level, grant.level)) {
        best = {
          level: grant.level,
          source: { type: 'role', roleId: grant.roleId },
        };
      }
    }
    result[resource] = best;
  }

  return result;
}
