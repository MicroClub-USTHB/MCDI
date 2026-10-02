import { apiClient } from '@/shared/lib/api-client';
import { env } from '@/shared/lib/env';
import { useAuthStore } from '@/features/auth/stores/auth';
import type { ApiResponse } from '@/shared/types';
import type {
  AuditLogFilters,
  AuditLogsResponse,
  AuthFailuresResponse,
  HealthStatus,
  MonitoringPeriod,
  UsageStats,
} from '@/features/monitoring/types';

function appendParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) params.set(key, value);
}

function buildAuditQuery(filters: AuditLogFilters, limit?: number, offset?: number): string {
  const params = new URLSearchParams();
  appendParam(params, 'dateFrom', filters.dateFrom);
  appendParam(params, 'dateTo', filters.dateTo);
  appendParam(params, 'actorId', filters.actorId);
  appendParam(params, 'actionType', filters.actionType);
  appendParam(params, 'severity', filters.severity);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  return params.toString();
}

export function fetchUsage(
  period: MonitoringPeriod,
  projectId?: string
): Promise<ApiResponse<UsageStats>> {
  const params = new URLSearchParams({ period });
  if (projectId) params.set('projectId', projectId);
  return apiClient.get<UsageStats>(`/admin/monitoring/usage?${params.toString()}`);
}

export function fetchHealth(): Promise<ApiResponse<HealthStatus>> {
  return apiClient.get<HealthStatus>('/admin/monitoring/health');
}

export function fetchAuthFailures(): Promise<ApiResponse<AuthFailuresResponse>> {
  return apiClient.get<AuthFailuresResponse>('/admin/monitoring/auth-failures?limit=50&offset=0');
}

export function fetchAuditLogs(
  page: number,
  filters: AuditLogFilters,
  pageSize = 50
): Promise<ApiResponse<AuditLogsResponse>> {
  const offset = (page - 1) * pageSize;
  const query = buildAuditQuery(filters, pageSize, offset);
  return apiClient.get<AuditLogsResponse>(`/admin/audit/logs?${query}`);
}

function getAuditExportFilename(response: Response): string {
  const contentDisposition = response.headers.get('Content-Disposition');
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/i);
  if (filenameMatch?.[1]) return filenameMatch[1];
  return `audit-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
}

export async function exportAuditLogs(filters: AuditLogFilters): Promise<void> {
  const query = buildAuditQuery(filters);
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/audit/logs/export?${query}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (response.status === 401) useAuthStore.getState().clearAuth();
  if (!response.ok) throw new Error('Could not export audit logs');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = getAuditExportFilename(response);
  link.click();
  URL.revokeObjectURL(url);
}
