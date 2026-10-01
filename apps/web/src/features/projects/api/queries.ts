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

export function useProjectsQuery(params?: ListProjectsParams) {
  return useQuery({
    queryKey: projectKeys.lists(params),
    queryFn: async () => {
      const response = await fetchProjects(params);
      return response.data;
    },
  });
}

export function useProjectQuery(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const response = await fetchProject(id);
      return response.data;
    },
    enabled: id.length > 0,
  });
}

export function useApiKeyInfoQuery(id: string) {
  return useQuery({
    queryKey: projectKeys.apiKey(id),
    queryFn: async () => {
      const response = await fetchApiKeyInfo(id);
      return response.data;
    },
    enabled: id.length > 0,
  });
}

export function useAccessMatrixQuery(projectId: string) {
  return useQuery({
    queryKey: projectKeys.accessMatrix({ projectId }),
    queryFn: async () => {
      const response = await fetchAccessMatrix({ projectId });
      return response.data;
    },
  });
}

export function useAccessAuditQuery(params?: ListAccessAuditParams) {
  return useQuery({
    queryKey: projectKeys.accessAudit(params),
    queryFn: async () => {
      const response = await fetchAccessAudit(params);
      return response.data;
    },
    enabled: params?.projectId != null,
  });
}

export type { ListAccessMatrixParams } from '@/features/projects/api/service';
