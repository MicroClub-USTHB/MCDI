import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../setup';
import type { MemberFilters } from '@/features/members/types';

const BASE_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useExportMembersMutation', () => {
  it('downloads the exported file with the active filters applied', async () => {
    let capturedUrl: URL | null = null;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:members');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const filters: MemberFilters = {
      filter: 'club',
      serverIds: ['987654321', '111111111'],
      roleIds: ['123456789', '222222222'],
      search: 'clubber',
      page: 1,
      pageSize: 50,
    };

    server.use(
      http.get(`${BASE_URL}/admin/members/export`, ({ request }) => {
        capturedUrl = new URL(request.url);
        return new HttpResponse('id,username\n123,clubber\n', {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="members.csv"',
          },
        });
      })
    );

    const { useExportMembersMutation } = await import('@/features/members/api/mutations');
    const { result } = renderHook(() => useExportMembersMutation(), { wrapper });

    result.current.mutate({ filters, format: 'csv' });

    await waitFor(() => expect(clickSpy).toHaveBeenCalledOnce());

    expect(capturedUrl?.searchParams.get('filter')).toBe('club');
    expect(capturedUrl?.searchParams.getAll('serverId')).toEqual(['987654321', '111111111']);
    expect(capturedUrl?.searchParams.getAll('roleId')).toEqual(['123456789', '222222222']);
    expect(capturedUrl?.searchParams.get('search')).toBe('clubber');
    expect(capturedUrl?.searchParams.get('format')).toBe('csv');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:members');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    clickSpy.mockRestore();
  });
});
