'use client';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { useAccessMatrixQuery } from '@/features/projects/api/queries';
import { fetchServerRoles } from '@/features/members/api/service';
import { memberKeys } from '@/features/members/api/keys';
import { inboundWebhookKeys } from '@/features/inbound-webhooks/api/keys';
import { buildRoleOptions, mapInboundWebhook } from '@/features/inbound-webhooks/api/mappers';
import {
  fetchAllowedRoles,
  fetchInboundSettings,
  fetchInboundWebhooks,
  previewSchema,
} from '@/features/inbound-webhooks/api/service';
import type { PreviewSchemaPayload } from '@/features/inbound-webhooks/types';

export function useInboundWebhooksQuery(projectId: string) {
  return useQuery({
    queryKey: inboundWebhookKeys.lists(projectId),
    queryFn: async () => {
      const response = await fetchInboundWebhooks(projectId);
      return response.data.map(mapInboundWebhook);
    },
  });
}

/** The reader roles of several webhooks, for the list's roles column. */
export function useAllowedRolesQueries(webhookIds: string[]) {
  return useQueries({
    queries: webhookIds.map((id) => ({
      queryKey: inboundWebhookKeys.roles(id),
      queryFn: async () => (await fetchAllowedRoles(id)).data,
    })),
  });
}

export function useInboundSettingsQuery() {
  return useQuery({
    queryKey: inboundWebhookKeys.settings(),
    queryFn: async () => (await fetchInboundSettings()).data,
  });
}

/**
 * The server's verdict on a schema. Pass `null` while the text is not valid
 * JSON yet. The previous answer is kept until the next arrives, so the
 * preview never flashes empty while the admin types.
 */
export function useSchemaPreviewQuery(payload: PreviewSchemaPayload | null) {
  return useQuery({
    queryKey: payload ? inboundWebhookKeys.preview(payload) : inboundWebhookKeys.all,
    queryFn: async () => (await previewSchema(payload as PreviewSchemaPayload)).data,
    enabled: payload !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * The roles an admin can grant for a project: those of the servers the project
 * can access, plus the default reader roles (which the API exempts from that
 * rule).
 */
export function useProjectRoleOptions(projectId: string) {
  const matrix = useAccessMatrixQuery(projectId);
  const settings = useInboundSettingsQuery();

  const serverIds = [...new Set((matrix.data ?? []).map((entry) => entry.serverId))];
  const roleQueries = useQueries({
    queries: serverIds.map((serverId) => ({
      queryKey: memberKeys.roles(serverId),
      queryFn: async () => (await fetchServerRoles(serverId)).data,
      retry: false,
    })),
  });

  const servers = roleQueries.flatMap((query) =>
    query.data
      ? [
          {
            serverId: query.data.serverId,
            serverName: query.data.serverName,
            roles: query.data.roles.map((role) => ({
              roleId: role.roleId,
              roleName: role.roleName,
            })),
          },
        ]
      : []
  );

  return {
    options: buildRoleOptions(servers, settings.data?.defaultReaderRoles ?? []),
    defaultRoleIds: settings.data?.defaultReaderRoleIds ?? [],
    isLoading: matrix.isPending || settings.isPending || roleQueries.some((q) => q.isPending),
    isError: matrix.isError || settings.isError,
  };
}
