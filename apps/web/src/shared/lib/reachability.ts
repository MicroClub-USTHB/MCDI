import { ACCESS_RESOURCES, type AccessResource, type GrantLevel } from '@mcdi/contracts';

import {
  allOf,
  canAccess,
  need,
  type AccessSubject,
  type Permissions,
  type Requirement,
} from '@/shared/lib/access';
import { RESOURCE_TITLES } from '@/shared/lib/access-labels';
import { ROUTE_RULES } from '@/shared/lib/route-access';

interface Leaf {
  resource: AccessResource;
  level: GrantLevel;
}

export interface UnreachableGrant {
  resource: AccessResource;
  /** What the member lacks for the grant to be usable in the panel. */
  missing: Leaf[];
}

/** Sections that make a resource usable but are not pages of their own in the route table. */
const EXTRA_USES: Array<{ resource: AccessResource; requires: Requirement }> = [
  {
    resource: 'messages',
    requires: allOf(need('servers', 'read'), need('channels', 'read'), need('messages', 'read')),
  },
  {
    resource: 'project_keys',
    requires: allOf(need('projects', 'read'), need('project_keys', 'read')),
  },
  { resource: 'settings', requires: need('settings', 'read') },
];

function leaves(requirement: Requirement): Leaf[] {
  switch (requirement.kind) {
    case 'permission':
      return [{ resource: requirement.resource, level: requirement.level }];
    case 'all':
    case 'any':
      return requirement.of.flatMap(leaves);
    default:
      return [];
  }
}

const USES: Array<{ requires: Requirement; resources: Set<AccessResource> }> = [
  ...ROUTE_RULES.map((rule) => rule.requires),
  ...EXTRA_USES.map((use) => use.requires),
].map((requires) => ({
  requires,
  resources: new Set(leaves(requires).map((leaf) => leaf.resource)),
}));

/**
 * The grants a member holds that no page or section can use, because a prerequisite is missing: a
 * server page needs `servers:read` for the server switcher, a role page needs statistics, and so on.
 * The API still allows such a grant; this only warns root that it has no effect in the panel.
 */
export function unreachableGrants(levels: Permissions): UnreachableGrant[] {
  const subject: AccessSubject = { root: false, permissions: levels };

  return ACCESS_RESOURCES.flatMap((resource) => {
    if (levels[resource] === 'none') return [];

    const candidates = USES.filter((use) => use.resources.has(resource));
    if (candidates.some((use) => canAccess(subject, use.requires))) return [];

    // The page that is closest to being usable: the fewest missing permissions.
    const options = candidates.map((use) =>
      leaves(use.requires).filter(
        (leaf, index, all) =>
          all.findIndex(
            (other) => other.resource === leaf.resource && other.level === leaf.level
          ) === index && !canAccess(subject, need(leaf.resource, leaf.level))
      )
    );
    const missing = options.sort((a, b) => a.length - b.length)[0] ?? [];
    return [{ resource, missing }];
  });
}

export function describeUnreachable(grant: UnreachableGrant): string {
  const needs = grant.missing
    .map((leaf) => `${RESOURCE_TITLES[leaf.resource]}: ${leaf.level}`)
    .join(' and ');
  return `${RESOURCE_TITLES[grant.resource]} needs ${needs} to be reachable in the panel`;
}
