'use client';

import { useQuery } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api/keys';
import {
  fetchAccessAudit,
  fetchAccessMatrix,
  fetchApiKeyInfo,
  fetchProject,
  fetchProjects,
  type ListAccessAuditParams,
  type ListProjectsParams,
} from '@/features/projects/api/service';
import { useCan } from '@/shared/lib/use-access';

export function useProjectsQuery(params?: ListProjectsParams) {
  const allowed = useCan('projects', 'read');
  return useQuery({
    queryKey: projectKeys.lists(params),
    queryFn: async () => {
      const response = await fetchProjects(params);
      return response.data;
    },
    enabled: allowed,
  });
}

export function useProjectQuery(id: string) {
  const allowed = useCan('projects', 'read');
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const response = await fetchProject(id);
      return response.data;
    },
    enabled: allowed && id.length > 0,
  });
}

export function useApiKeyInfoQuery(id: string) {
  const allowed = useCan('project_keys', 'read');
  return useQuery({
    queryKey: projectKeys.apiKey(id),
    queryFn: async () => {
      const response = await fetchApiKeyInfo(id);
      return response.data;
    },
    enabled: allowed && id.length > 0,
  });
}

export function useAccessMatrixQuery(projectId: string) {
  const allowed = useCan('projects', 'read');
  return useQuery({
    queryKey: projectKeys.accessMatrix({ projectId }),
    queryFn: async () => {
      const response = await fetchAccessMatrix({ projectId });
      return response.data;
    },
    enabled: allowed,
  });
}

export function useAccessAuditQuery(params?: ListAccessAuditParams) {
  const allowed = useCan('projects', 'read');
  return useQuery({
    queryKey: projectKeys.accessAudit(params),
    queryFn: async () => {
      const response = await fetchAccessAudit(params);
      return response.data;
    },
    enabled: allowed && params?.projectId != null,
  });
}

export type { ListAccessMatrixParams } from '@/features/projects/api/service';
