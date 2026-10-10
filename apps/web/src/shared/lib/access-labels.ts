import type { AccessResource } from '@mcdi/contracts';

import type { Requirement } from '@/shared/lib/access';

export const RESOURCE_TITLES: Record<AccessResource, string> = {
  servers: 'Servers',
  members: 'Members',
  channels: 'Channels',
  messages: 'Messages',
  roles: 'Roles',
  projects: 'Projects',
  project_keys: 'Project API keys',
  webhooks: 'Webhooks',
  inbound_webhooks: 'Inbound webhooks',
  sync: 'Sync',
  stats: 'Statistics',
  audit: 'Audit log',
  monitoring: 'Monitoring',
  settings: 'Settings',
};

/** A requirement in words, for the "you do not have access" page and the Access screen hints. */
export function describeRequirement(requirement: Requirement): string {
  switch (requirement.kind) {
    case 'open':
      return 'Any signed-in admin';
    case 'anyAccess':
      return 'Access to at least one area';
    case 'root':
      return 'Root access';
    case 'permission':
      return `${RESOURCE_TITLES[requirement.resource]}: ${requirement.level}`;
    case 'all':
      return requirement.of.map(describeRequirement).join(' and ');
    case 'any':
      return requirement.of.map(describeRequirement).join(' or ');
  }
}
