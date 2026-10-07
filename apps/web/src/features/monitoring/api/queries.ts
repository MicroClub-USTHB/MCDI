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
import { useCan } from '@/shared/lib/use-access';

// Error stats ride along on this query instead of a separate useErrorStatsQuery —
// /admin/monitoring/usage returns both in one payload, so a second request/cache key
// would just duplicate this one.
export function useApiUsageQuery(period: MonitoringPeriod, projectId?: string) {
  const allowed = useCan('monitoring', 'read');
  return useQuery({
    queryKey: monitoringKeys.usage(period, projectId),
    queryFn: async () => mapUsageResponse((await fetchUsage(period, projectId)).data),
    retry: false,
    enabled: allowed,
  });
}

export function useSystemHealthQuery() {
  const allowed = useCan('monitoring', 'read');
  return useQuery({
    queryKey: monitoringKeys.health(),
    queryFn: async () => mapHealthResponse((await fetchHealth()).data),
    refetchInterval: 60_000,
    retry: false,
    enabled: allowed,
  });
}

export function useAuthFailuresQuery() {
  const allowed = useCan('monitoring', 'read');
  return useQuery({
    queryKey: monitoringKeys.authFailures(),
    queryFn: async () => mapAuthFailuresResponse((await fetchAuthFailures()).data),
    retry: false,
    enabled: allowed,
  });
}

export function useAuditLogsQuery(page: number, filters: AuditLogFilters) {
  const allowed = useCan('audit', 'read');
  return useQuery({
    queryKey: monitoringKeys.auditLogs(page, filters),
    queryFn: async () => mapAuditLogsResponse((await fetchAuditLogs(page, filters)).data),
    retry: false,
    placeholderData: (previousData) => previousData,
    enabled: allowed,
  });
}
