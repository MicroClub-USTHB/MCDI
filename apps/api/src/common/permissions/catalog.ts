/**
 * The catalog of admin access. Every admin endpoint declares one resource and
 * one level from here. It lives in code rather than the database because a new
 * endpoint needs code anyway.
 */
export const ACCESS_RESOURCES = [
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
] as const;
export type AccessResource = (typeof ACCESS_RESOURCES)[number];

/** Ordered: each level includes everything below it. */
export const ACCESS_LEVELS = ['none', 'read', 'write', 'manage'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** A level a role can be granted. `none` exists only as a member override (a deny). */
export type GrantLevel = Exclude<AccessLevel, 'none'>;
export const GRANT_LEVELS: readonly GrantLevel[] = ['read', 'write', 'manage'];

const RANK: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  manage: 3,
};

/** True when `effective` is at least `required` (none < read < write < manage). */
export function levelAtLeast(
  effective: AccessLevel,
  required: AccessLevel,
): boolean {
  return RANK[effective] >= RANK[required];
}

export function isAccessResource(value: unknown): value is AccessResource {
  return (
    typeof value === 'string' &&
    (ACCESS_RESOURCES as readonly string[]).includes(value)
  );
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === 'string' &&
    (ACCESS_LEVELS as readonly string[]).includes(value)
  );
}

export function isGrantLevel(value: unknown): value is GrantLevel {
  return isAccessLevel(value) && value !== 'none';
}

export const RESOURCE_DESCRIPTIONS: Record<AccessResource, string> = {
  servers:
    'Discord servers registered in MCDI: list, register, edit, enable, disable and delete.',
  members:
    'The member directory: lists, cross-server views and exports of member data.',
  channels: 'The channel structure of a server (names and types), not the messages.',
  messages:
    'The text of messages in a channel. The most sensitive data in MCDI.',
  roles:
    'Discord roles in MCDI: their permissions, inheritance rules and the impact of changing them.',
  projects: 'Projects that integrate with MCDI and their access to servers.',
  project_keys:
    'Project API keys: view key details, regenerate, restore and revoke.',
  webhooks: 'Outgoing Discord webhooks created by projects.',
  inbound_webhooks:
    'Inbound webhooks, their schemas, reader roles, secrets and settings.',
  sync: 'Synchronization with Discord: status, logs and triggering a full sync.',
  stats: 'Statistics about members, roles and servers, and their exports.',
  audit: 'The audit log and its export.',
  monitoring: 'Service health, endpoint usage and authentication failures.',
  settings: 'Runtime settings of the API.',
};

export const LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  none: 'No access.',
  read: 'View only, including previews and exports.',
  write: 'Read, plus create, update and trigger non-destructive actions.',
  manage: 'Write, plus delete, reset and revoke.',
};
