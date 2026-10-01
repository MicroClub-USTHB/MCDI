'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '@/features/projects/api/keys';
import {
  createProject,
  deactivateProject,
  deleteProject,
  reactivateProject,
  regenerateApiKey,
  revokeServerAccess,
  setServerAccess,
  updateProject,
  updateRedirectUri,
} from '@/features/projects/api/service';
import type {
  CreateProjectPayload,
  SetServerAccessPayload,
  UpdateProjectPayload,
} from '@/features/projects/types';

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectPayload }) =>
      updateProject(id, payload),
    onSuccess: (_response, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

/** Deactivates the ENTIRE project — blocks all of its API access, not just its key. */
export function useDeactivateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deactivateProject(id),
    onSuccess: (_response, id) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.apiKey(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/** Reactivates a deactivated project. */
export function useReactivateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => reactivateProject(id),
    onSuccess: (_response, id) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.apiKey(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useRegenerateApiKeyMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => regenerateApiKey(id),
    onSuccess: (_response, id) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.apiKey(id) });
    },
  });
}

export function useUpdateRedirectUriMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, redirectUri }: { id: string; redirectUri: string }) =>
      updateRedirectUri(id, redirectUri),
    onSuccess: (_response, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}

export function useSetServerAccessMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serverId, payload }: { serverId: string; payload: SetServerAccessPayload }) =>
      setServerAccess(projectId, serverId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.accessMatrix({ projectId }) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.accessAudit({ projectId }) });
    },
  });
}

export function useRevokeServerAccessMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serverId: string) => revokeServerAccess(projectId, serverId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.accessMatrix({ projectId }) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.accessAudit({ projectId }) });
    },
  });
}
