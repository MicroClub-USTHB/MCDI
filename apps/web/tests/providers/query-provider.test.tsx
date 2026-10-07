import { useQuery } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../setup';
import { authKeys } from '@/features/auth/api/keys';
import { QueryProvider } from '@/providers/QueryProvider';
import { ApiClient } from '@/shared/lib/api-client';

const API = 'http://localhost:3000/api';

function CurrentAdminProbe({ onFetch }: { onFetch: () => void }) {
  useQuery({
    queryKey: authKeys.me(),
    queryFn: () => {
      onFetch();
      return { ok: true };
    },
    staleTime: Infinity,
  });
  return null;
}

describe('QueryProvider', () => {
  it('refetches the current admin when the API answers 403', async () => {
    let fetches = 0;
    server.use(
      http.get(`${API}/admin/members`, () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 })
      )
    );
    render(
      <QueryProvider>
        <CurrentAdminProbe onFetch={() => (fetches += 1)} />
      </QueryProvider>
    );
    await waitFor(() => expect(fetches).toBe(1));

    await expect(new ApiClient(API).get('/admin/members')).rejects.toMatchObject({ status: 403 });

    await waitFor(() => expect(fetches).toBe(2));
  });

  it('shares one refetch between refusals that arrive together', async () => {
    let fetches = 0;
    server.use(
      http.get(`${API}/admin/members`, () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 })
      )
    );
    render(
      <QueryProvider>
        <CurrentAdminProbe onFetch={() => (fetches += 1)} />
      </QueryProvider>
    );
    await waitFor(() => expect(fetches).toBe(1));

    const client = new ApiClient(API);
    await Promise.allSettled([client.get('/admin/members'), client.get('/admin/members')]);

    await waitFor(() => expect(fetches).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetches).toBe(2);
  });
});
