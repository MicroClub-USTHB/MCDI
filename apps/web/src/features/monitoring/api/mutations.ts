'use client';

import { useMutation } from '@tanstack/react-query';

import { exportAuditLogs } from '@/features/monitoring/api/service';
import type { AuditLogFilters } from '@/features/monitoring/types';

export function useExportAuditLogsMutation() {
  return useMutation({ mutationFn: (filters: AuditLogFilters) => exportAuditLogs(filters) });
}
