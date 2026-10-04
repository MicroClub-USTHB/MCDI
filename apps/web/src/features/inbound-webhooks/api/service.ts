import { apiClient } from '@/shared/lib/api-client';
import type { ApiResponse } from '@/shared/types';
import type {
  AllowedRoleDto,
  CreateInboundWebhookPayload,
  CreateInboundWebhookResponse,
  InboundWebhookDto,
  InboundWebhookSettingsDto,
  PreviewSchemaPayload,
  SchemaPreviewDto,
} from '@/features/inbound-webhooks/types';

const BASE = '/admin/inbound-webhooks';

export function fetchInboundWebhooks(projectId: string): Promise<ApiResponse<InboundWebhookDto[]>> {
  return apiClient.get<InboundWebhookDto[]>(`${BASE}?projectId=${encodeURIComponent(projectId)}`);
}

export function fetchAllowedRoles(webhookId: string): Promise<ApiResponse<AllowedRoleDto[]>> {
  return apiClient.get<AllowedRoleDto[]>(`${BASE}/${encodeURIComponent(webhookId)}/roles`);
}

/** Checks a schema and renders its docs without saving anything. */
export function previewSchema(
  payload: PreviewSchemaPayload
): Promise<ApiResponse<SchemaPreviewDto>> {
  return apiClient.post<SchemaPreviewDto>(`${BASE}/schema/preview`, payload);
}

export function createInboundWebhook(
  payload: CreateInboundWebhookPayload
): Promise<ApiResponse<CreateInboundWebhookResponse>> {
  return apiClient.post<CreateInboundWebhookResponse>(BASE, payload);
}

export function fetchInboundSettings(): Promise<ApiResponse<InboundWebhookSettingsDto>> {
  return apiClient.get<InboundWebhookSettingsDto>(`${BASE}/settings`);
}

export function updateInboundSettings(
  defaultReaderRoleIds: string[]
): Promise<ApiResponse<InboundWebhookSettingsDto>> {
  return apiClient.put<InboundWebhookSettingsDto>(`${BASE}/settings`, {
    defaultReaderRoleIds,
  });
}
