'use client';

import { useQuery } from '@tanstack/react-query';

import { monitoringKeys } from '@/features/monitoring/api/keys';
import {
  fetchAuditLogs,
  fetchAuthFailures,
  fetchHealth,
  fetchUsage,
} from '@/features/monitoring/api/service';
import {
  mapAuditLogsResponse,
  mapAuthFailuresResponse,
  mapHealthResponse,
  mapUsageResponse,
} from '@/features/monitoring/api/mappers';
import type { AuditLogFilters, MonitoringPeriod } from '@/features/monitoring/types';

// Error stats ride along on this query instead of a separate useErrorStatsQuery —
// /admin/monitoring/usage returns both in one payload, so a second request/cache key
// would just duplicate this one.
export function useApiUsageQuery(period: MonitoringPeriod, projectId?: string) {
  return useQuery({
    queryKey: monitoringKeys.usage(period, projectId),
    queryFn: async () => mapUsageResponse((await fetchUsage(period, projectId)).data),
    retry: false,
  });
}

export function useSystemHealthQuery() {
  return useQuery({
    queryKey: monitoringKeys.health(),
    queryFn: async () => mapHealthResponse((await fetchHealth()).data),
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useAuthFailuresQuery() {
  return useQuery({
    queryKey: monitoringKeys.authFailures(),
    queryFn: async () => mapAuthFailuresResponse((await fetchAuthFailures()).data),
    retry: false,
  });
}

export function useAuditLogsQuery(page: number, filters: AuditLogFilters) {
  return useQuery({
    queryKey: monitoringKeys.auditLogs(page, filters),
    queryFn: async () => mapAuditLogsResponse((await fetchAuditLogs(page, filters)).data),
    retry: false,
    placeholderData: (previousData) => previousData,
  });
}
