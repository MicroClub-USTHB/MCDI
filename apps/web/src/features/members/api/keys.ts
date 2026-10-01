import type { MemberFilters } from '@/features/members/types';

export const memberKeys = {
  all: ['members'] as const,
  list: (filters: MemberFilters) => [...memberKeys.all, 'list', filters] as const,
  detail: (discordId: string) => [...memberKeys.all, 'detail', discordId] as const,
  servers: (discordId: string) => [...memberKeys.all, 'servers', discordId] as const,
  roles: (serverId: string) => [...memberKeys.all, 'roles', serverId] as const,
  permissions: (serverId: string, discordId: string) =>
    [...memberKeys.all, 'permissions', serverId, discordId] as const,
} as const;
