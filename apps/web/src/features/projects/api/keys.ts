import type {
  ListAccessAuditParams,
  ListAccessMatrixParams,
  ListProjectsParams,
} from '@/features/projects/api/service';

export const projectKeys = {
  all: ['projects'] as const,
  lists: (params?: ListProjectsParams) => [...projectKeys.all, 'list', params] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  apiKey: (id: string) => [...projectKeys.all, 'api-key', id] as const,
  accessMatrix: (params?: ListAccessMatrixParams) =>
    [...projectKeys.all, 'access-matrix', params] as const,
  accessAudit: (params?: ListAccessAuditParams) =>
    [...projectKeys.all, 'access-audit', params] as const,
};
