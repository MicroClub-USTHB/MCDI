'use client';

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { useAccessMatrixQuery } from '@/features/projects/api/queries';
import { useServersQuery } from '@/features/servers/api/queries';
import { fetchServerRoles } from '@/features/members/api/service';
import { memberKeys } from '@/features/members/api/keys';
import { inboundWebhookKeys } from '@/features/inbound-webhooks/api/keys';
import { buildRoleOptions, mapInboundWebhook } from '@/features/inbound-webhooks/api/mappers';
import {
  fetchAllowedRoles,
  fetchInboundSettings,
  fetchInboundWebhook,
  fetchInboundWebhooks,
  fetchSubmission,
  fetchSubmissions,
  fetchWebhookDocs,
  previewSchema,
} from '@/features/inbound-webhooks/api/service';
import type { PreviewSchemaPayload, SubmissionFilters } from '@/features/inbound-webhooks/types';

export function useInboundWebhooksQuery(projectId: string) {
  return useQuery({
    queryKey: inboundWebhookKeys.lists(projectId),
    queryFn: async () => {
      const response = await fetchInboundWebhooks(projectId);
      return response.data.map(mapInboundWebhook);
    },
  });
}

/** The reader roles of one webhook. */
export function useAllowedRolesQuery(webhookId: string) {
  return useQuery({
    queryKey: inboundWebhookKeys.roles(webhookId),
    queryFn: async () => (await fetchAllowedRoles(webhookId)).data,
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

function useServerRoles(serverIds: string[]) {
  const queries = useQueries({
    queries: serverIds.map((serverId) => ({
      queryKey: memberKeys.roles(serverId),
      queryFn: async () => (await fetchServerRoles(serverId)).data,
      retry: false,
    })),
  });

  const servers = queries.flatMap((query) =>
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
  return { servers, isPending: queries.some((query) => query.isPending) };
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
  const roles = useServerRoles(serverIds);

  return {
    options: buildRoleOptions(roles.servers, settings.data?.defaultReaderRoles ?? []),
    defaultRoleIds: settings.data?.defaultReaderRoleIds ?? [],
    isLoading: matrix.isPending || settings.isPending || roles.isPending,
    isError: matrix.isError || settings.isError,
  };
}

/** Every role of every server, for choosing the default readers. */
export function useAllRoleOptions() {
  const servers = useServersQuery();
  const settings = useInboundSettingsQuery();
  const roles = useServerRoles((servers.data ?? []).map((server) => server.id));

  return {
    options: buildRoleOptions(roles.servers, settings.data?.defaultReaderRoles ?? []),
    isLoading: servers.isPending || roles.isPending,
  };
}

export function useInboundWebhookQuery(webhookId: string) {
  return useQuery({
    queryKey: inboundWebhookKeys.detail(webhookId),
    queryFn: async () => (await fetchInboundWebhook(webhookId)).data,
  });
}

export function useWebhookDocsQuery(webhookId: string, enabled: boolean) {
  return useQuery({
    queryKey: inboundWebhookKeys.docs(webhookId),
    queryFn: async () => (await fetchWebhookDocs(webhookId)).data,
    enabled,
  });
}

/** The previous page stays on screen while the next one loads, so paging never flashes empty. */
export function useSubmissionsQuery(webhookId: string, filters: SubmissionFilters) {
  return useQuery({
    queryKey: inboundWebhookKeys.submissions(webhookId, filters),
    queryFn: async () => (await fetchSubmissions(webhookId, filters)).data,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useSubmissionQuery(webhookId: string, submissionId: string | null) {
  return useQuery({
    queryKey: inboundWebhookKeys.submission(webhookId, submissionId ?? ''),
    queryFn: async () => (await fetchSubmission(webhookId, submissionId ?? '')).data,
    enabled: submissionId !== null,
    retry: false,
  });
}
