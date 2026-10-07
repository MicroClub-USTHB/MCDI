import {
  ACCESS_RESOURCES,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from '@mcdi/contracts';

export type Permissions = Record<AccessResource, AccessLevel>;

/** The part of a signed-in user the rules read. */
export interface AccessSubject {
  root: boolean;
  permissions: Permissions;
}

export type Requirement =
  | { kind: 'open' } // any signed-in admin
  | { kind: 'anyAccess' } // at least one resource above none
  | { kind: 'root' }
  | { kind: 'permission'; resource: AccessResource; level: GrantLevel }
  | { kind: 'all'; of: Requirement[] }
  | { kind: 'any'; of: Requirement[] };

export const OPEN: Requirement = { kind: 'open' };
export const ANY_ACCESS: Requirement = { kind: 'anyAccess' };
export const ROOT_ONLY: Requirement = { kind: 'root' };

export function need(resource: AccessResource, level: GrantLevel): Requirement {
  return { kind: 'permission', resource, level };
}

export function allOf(...of: Requirement[]): Requirement {
  return { kind: 'all', of };
}

export function anyOf(...of: Requirement[]): Requirement {
  return { kind: 'any', of };
}

export function levelOf(subject: AccessSubject | null, resource: AccessResource): AccessLevel {
  if (!subject) return 'none';
  if (subject.root) return 'manage';
  // A persisted user from before permissions existed has no map: treat it as no access.
  return subject.permissions?.[resource] ?? 'none';
}

export function hasAnyAccess(subject: AccessSubject | null): boolean {
  if (!subject) return false;
  return subject.root || ACCESS_RESOURCES.some((resource) => levelOf(subject, resource) !== 'none');
}

export function canAccess(subject: AccessSubject | null, requirement: Requirement): boolean {
  if (!subject) return false;
  switch (requirement.kind) {
    case 'open':
      return true;
    case 'anyAccess':
      return hasAnyAccess(subject);
    case 'root':
      return subject.root === true;
    case 'permission':
      return levelAtLeast(levelOf(subject, requirement.resource), requirement.level);
    case 'all':
      return requirement.of.every((part) => canAccess(subject, part));
    case 'any':
      return requirement.of.some((part) => canAccess(subject, part));
  }
}
