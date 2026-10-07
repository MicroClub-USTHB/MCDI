import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import { useAuditLogsQuery, useSystemHealthQuery } from '@/features/monitoring/api/queries';
import { useInboundSettingsQuery } from '@/features/inbound-webhooks/api/queries';
import { useProjectsQuery } from '@/features/projects/api/queries';
import { useServerStatsQuery } from '@/features/stats/api/queries';
import { useServersQuery } from '@/features/servers/api/queries';
import { useSettingsQuery } from '@/features/settings/api/queries';
import { useSyncStatusAllQuery } from '@/features/sync/api/queries';
import { useWebhooksQuery } from '@/features/webhooks/api/queries';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Each hook, the resource it needs, and an endpoint that answers when it is called. */
const CASES = [
  {
    name: 'useServersQuery',
    resource: 'servers',
    path: '/servers',
    useRun: () => useServersQuery(),
  },
  {
    name: 'useProjectsQuery',
    resource: 'projects',
    path: '/admin/projects',
    useRun: () => useProjectsQuery(),
  },
  {
    name: 'useServerStatsQuery',
    resource: 'stats',
    path: '/admin/stats/servers',
    useRun: () => useServerStatsQuery(),
  },
  {
    name: 'useSyncStatusAllQuery',
    resource: 'sync',
    path: '/admin/sync/status/all',
    useRun: () => useSyncStatusAllQuery(),
  },
  {
    name: 'useSettingsQuery',
    resource: 'settings',
    path: '/admin/settings',
    useRun: () => useSettingsQuery(),
  },
  {
    name: 'useSystemHealthQuery',
    resource: 'monitoring',
    path: '/admin/monitoring/health',
    useRun: () => useSystemHealthQuery(),
  },
  {
    name: 'useAuditLogsQuery',
    resource: 'audit',
    path: '/admin/audit/logs',
    useRun: () => useAuditLogsQuery(1, {}),
  },
  {
    name: 'useInboundSettingsQuery',
    resource: 'inbound_webhooks',
    path: '/admin/inbound-webhooks/settings',
    useRun: () => useInboundSettingsQuery(),
  },
  {
    name: 'useWebhooksQuery',
    resource: 'webhooks',
    path: '/admin/projects/p1/webhooks',
    useRun: () => useWebhooksQuery('p1'),
  },
] as const;

describe.each(CASES)('$name', ({ resource, path, useRun }) => {
  it(`sends no request without ${resource}:read`, async () => {
    let requested = false;
    server.use(
      http.get(`${API}${path}`, () => {
        requested = true;
        return HttpResponse.json({});
      })
    );
    signInAs({ permissions: {} });

    const { result } = renderHook(useRun, { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).toBe(false);
  });

  it(`fetches with ${resource}:read`, async () => {
    let requested = false;
    // An error response keeps the response mappers out of the test: it only checks that the call is made.
    server.use(
      http.get(`${API}${path}`, () => {
        requested = true;
        return HttpResponse.json({ message: 'stop' }, { status: 500 });
      })
    );
    signInAs({ permissions: { [resource]: 'read' } });

    renderHook(useRun, { wrapper });

    await waitFor(() => expect(requested).toBe(true));
  });
});
