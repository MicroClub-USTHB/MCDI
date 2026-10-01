import type {
  AuditLog,
  AuditLogsResponse,
  AuthFailure,
  AuthFailuresResponse,
  HealthStatus,
  UsageStats,
} from '@/features/monitoring/types';

export function mapUsageResponse(dto: UsageStats): UsageStats {
  return dto;
}

export function mapHealthResponse(dto: HealthStatus): HealthStatus {
  return dto;
}

export function mapAuthFailuresResponse(dto: AuthFailuresResponse): AuthFailuresResponse {
  return { ...dto, failures: dto.failures.map((failure: AuthFailure) => failure) };
}

export function mapAuditLogsResponse(dto: AuditLogsResponse): AuditLogsResponse {
  return { ...dto, logs: dto.logs.map((log: AuditLog) => log) };
}
