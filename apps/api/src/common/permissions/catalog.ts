import {
  ACCESS_LEVELS,
  ACCESS_RESOURCES,
  GRANT_LEVELS,
  isAccessLevel,
  isAccessResource,
  isGrantLevel,
  levelAtLeast,
  type AccessLevel,
  type AccessResource,
  type GrantLevel,
} from '@mcdi/contracts';

export {
  ACCESS_LEVELS,
  ACCESS_RESOURCES,
  GRANT_LEVELS,
  isAccessLevel,
  isAccessResource,
  isGrantLevel,
  levelAtLeast,
};
export type { AccessLevel, AccessResource, GrantLevel };

export const RESOURCE_DESCRIPTIONS: Record<AccessResource, string> = {
  servers:
    'Discord servers registered in MCDI: list, register, edit, enable, disable and delete.',
  members:
    'The member directory: lists, cross-server views and exports of member data.',
  channels:
    'The channel structure of a server (names and types), not the messages.',
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
