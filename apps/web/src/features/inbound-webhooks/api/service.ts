import { apiClient } from '@/shared/lib/api-client';
import { env } from '@/shared/lib/env';
import type { ApiResponse } from '@/shared/types';
import type {
  AllowedRoleDto,
  CreateInboundWebhookPayload,
  CreateInboundWebhookResponse,
  InboundWebhookDto,
  InboundWebhookSettingsDto,
  PreviewSchemaPayload,
  SchemaPreviewDto,
  SubmissionDetailDto,
  SubmissionFilters,
  SubmissionPageDto,
  UpdateInboundWebhookPayload,
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

const READ_BASE = '/inbound-webhooks';

export function fetchInboundWebhook(webhookId: string): Promise<ApiResponse<InboundWebhookDto>> {
  return apiClient.get<InboundWebhookDto>(`${BASE}/${encodeURIComponent(webhookId)}`);
}

export function updateInboundWebhook(
  webhookId: string,
  patch: UpdateInboundWebhookPayload
): Promise<ApiResponse<InboundWebhookDto>> {
  return apiClient.patch<InboundWebhookDto>(`${BASE}/${encodeURIComponent(webhookId)}`, patch);
}

/** The developer guide, as Markdown. */
export function fetchWebhookDocs(webhookId: string): Promise<ApiResponse<string>> {
  return apiClient.getText(`${BASE}/${encodeURIComponent(webhookId)}/docs`);
}

/** The docs as a file: the browser sends the session cookie when it follows the link. */
export function docsDownloadUrl(webhookId: string, format: 'markdown' | 'openapi'): string {
  return `${env.NEXT_PUBLIC_API_URL}${BASE}/${encodeURIComponent(webhookId)}/docs?format=${format}&download=true`;
}

/** A date-only `to` means midnight UTC, which would leave out that whole day. */
function toQuery(filters: SubmissionFilters): string {
  const params = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
  });
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', `${filters.dateTo}T23:59:59.999Z`);
  return params.toString();
}

export function fetchSubmissions(
  webhookId: string,
  filters: SubmissionFilters
): Promise<ApiResponse<SubmissionPageDto>> {
  return apiClient.get<SubmissionPageDto>(
    `${READ_BASE}/${encodeURIComponent(webhookId)}/submissions?${toQuery(filters)}`
  );
}

export function fetchSubmission(
  webhookId: string,
  submissionId: string
): Promise<ApiResponse<SubmissionDetailDto>> {
  return apiClient.get<SubmissionDetailDto>(
    `${READ_BASE}/${encodeURIComponent(webhookId)}/submissions/${encodeURIComponent(submissionId)}`
  );
}
