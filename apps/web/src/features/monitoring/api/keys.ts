import type { AuditLogFilters, MonitoringPeriod } from '@/features/monitoring/types';

export const monitoringKeys = {
  all: ['monitoring'] as const,
  usage: (period: MonitoringPeriod, projectId?: string) =>
    [...monitoringKeys.all, 'usage', period, projectId] as const,
  health: () => [...monitoringKeys.all, 'health'] as const,
  authFailures: () => [...monitoringKeys.all, 'auth-failures'] as const,
  auditLogs: (page: number, filters: AuditLogFilters) =>
    [...monitoringKeys.all, 'audit-logs', page, filters] as const,
} as const;
