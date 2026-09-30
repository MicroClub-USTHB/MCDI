import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { fetchAuditLogs } from '@/features/monitoring/api/service';
import type { AuditActionType, AuditLogFilters } from '@/features/monitoring/types';

const BASE_URL = 'http://localhost:3000/api';

const ACTIONS: AuditActionType[] = [
  'auth',
  'project',
  'server',
  'role',
  'webhook',
  'member',
  'sync',
  'permission',
];

describe('monitoring api service', () => {
  it('builds audit log query params for the active filters and pagination', async () => {
    let capturedUrl: URL | undefined;
    const filters: AuditLogFilters = {
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      actorId: 'admin-1',
      severity: 'warning',
      actionType: 'project',
    };

    server.use(
      http.get(`${BASE_URL}/admin/audit/logs`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          logs: [],
          total: 0,
          limit: 25,
          offset: 25,
        });
      })
    );

    await fetchAuditLogs(2, filters, 25);

    expect(capturedUrl?.searchParams.get('dateFrom')).toBe('2026-04-01');
    expect(capturedUrl?.searchParams.get('dateTo')).toBe('2026-04-30');
    expect(capturedUrl?.searchParams.get('actorId')).toBe('admin-1');
    expect(capturedUrl?.searchParams.get('severity')).toBe('warning');
    expect(capturedUrl?.searchParams.get('actionType')).toBe('project');
    expect(capturedUrl?.searchParams.get('limit')).toBe('25');
    expect(capturedUrl?.searchParams.get('offset')).toBe('25');
  });

  it.each(ACTIONS)('includes %s in the actionType query param', async (actionType) => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get(`${BASE_URL}/admin/audit/logs`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          logs: [],
          total: 0,
          limit: 50,
          offset: 0,
        });
      })
    );

    await fetchAuditLogs(1, { actionType }, 50);

    expect(capturedUrl?.searchParams.get('actionType')).toBe(actionType);
  });
});
