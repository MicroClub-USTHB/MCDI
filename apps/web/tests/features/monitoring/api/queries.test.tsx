import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { useApiUsageQuery } from '@/features/monitoring/api/queries';

const BASE_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('monitoring queries', () => {
  it('requests usage for the selected period and project', async () => {
    let capturedUrl: URL | undefined;
    server.use(
      http.get(`${BASE_URL}/admin/monitoring/usage`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({
          totalRequests: 12,
          byProject: [],
          byEndpoint: [],
          errors: { total: 1, byType: { '4xx': 1, '5xx': 0 } },
        });
      })
    );

    const { result } = renderHook(() => useApiUsageQuery('7d', 'project-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedUrl?.searchParams.get('period')).toBe('7d');
    expect(capturedUrl?.searchParams.get('projectId')).toBe('project-1');
    expect(result.current.data?.totalRequests).toBe(12);
  });
});
