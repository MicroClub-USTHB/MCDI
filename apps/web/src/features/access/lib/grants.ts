import {
  ACCESS_RESOURCES,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from '@mcdi/contracts';

import type { MemberOverridesMap, RoleGrantsDto } from '@/features/access/types';

/** A level for every resource: what a role editor edits. */
export type Draft = Record<AccessResource, AccessLevel>;

/** A resource missing from the map is inherited: what a member editor edits. */
export type OverrideDraft = MemberOverridesMap;

export function draftFromGrants(grants: RoleGrantsDto): Draft {
  return Object.fromEntries(
    ACCESS_RESOURCES.map((resource) => [resource, grants[resource] ?? 'none'])
  ) as Draft;
}

/** The body of the role PUT: a resource set to none has no grant, so it is left out. */
export function grantsPayload(draft: Draft): RoleGrantsDto {
  const payload: RoleGrantsDto = {};
  for (const resource of ACCESS_RESOURCES) {
    const level = draft[resource];
    if (level !== 'none') payload[resource] = level as GrantLevel;
  }
  return payload;
}

export function isDirty(saved: Draft, draft: Draft): boolean {
  return ACCESS_RESOURCES.some((resource) => saved[resource] !== draft[resource]);
}

function isLower(next: AccessLevel, current: AccessLevel): boolean {
  return next !== current && levelAtLeast(current, next);
}

/** The resources whose level goes down: a save that includes any of them asks first. */
export function loweredResources(before: Draft, after: Draft): AccessResource[] {
  return ACCESS_RESOURCES.filter((resource) => isLower(after[resource], before[resource]));
}

/** The body of the member PUT. Inherited resources are not in it. */
export function overridesPayload(draft: OverrideDraft): MemberOverridesMap {
  const payload: MemberOverridesMap = {};
  for (const resource of ACCESS_RESOURCES) {
    const level = draft[resource];
    if (level !== undefined) payload[resource] = level;
  }
  return payload;
}

/** The resources whose override is below what the member holds now. Inheriting is never lowering. */
export function loweredOverrides(effective: Draft, draft: OverrideDraft): AccessResource[] {
  return ACCESS_RESOURCES.filter((resource) => {
    const level = draft[resource];
    return level !== undefined && isLower(level, effective[resource]);
  });
}
