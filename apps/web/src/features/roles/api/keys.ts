import type { ImpactPreviewPayload, ListInheritanceRulesParams } from '@/features/roles/types';

export const roleKeys = {
  all: ['roles'] as const,
  stats: (serverId: string) => [...roleKeys.all, 'stats', serverId] as const,
  permissions: (serverId: string, roleId: string) =>
    [...roleKeys.all, 'permissions', serverId, roleId] as const,
  impact: (serverId: string, roleId: string, payload: ImpactPreviewPayload) =>
    [...roleKeys.all, 'impact', serverId, roleId, payload] as const,
  inheritance: (params?: ListInheritanceRulesParams) =>
    [...roleKeys.all, 'inheritance', params] as const,
  inheritanceList: ['roles', 'inheritance'] as const,
};
