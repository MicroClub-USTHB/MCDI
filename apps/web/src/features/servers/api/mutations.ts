'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serverKeys } from '@/features/servers/api/keys';
import {
  createServer,
  deleteServer,
  disableServer,
  enableServer,
  updateServer,
} from '@/features/servers/api/service';
import type {
  CreateServerPayload,
  DisableServerPayload,
  UpdateServerPayload,
} from '@/features/servers/types';

export function useCreateServerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateServerPayload) => createServer(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
    },
  });
}

export function useDisableServerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DisableServerPayload }) =>
      disableServer(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
    },
  });
}

export function useEnableServerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => enableServer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
    },
  });
}

export function useUpdateServerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServerPayload }) =>
      updateServer(id, payload),
    onSuccess: (_response, { id }) => {
      void queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serverKeys.detail(id) });
    },
  });
}

export function useDeleteServerMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteServer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serverKeys.lists() });
    },
  });
}
