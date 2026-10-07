import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { signInAs } from '../../../helpers/auth';
import {
  useAccessRolesQuery,
  useMemberEffectiveQuery,
  useOverridesListQuery,
  useSetMemberOverridesMutation,
  useSetRoleGrantsMutation,
} from '@/features/access';

const API = 'http://localhost:3000/api';

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('access queries', () => {
  it('fetches the roles for root', async () => {
    server.use(
      http.get(`${API}/admin/access/roles`, () =>
        HttpResponse.json([
          { id: 'r1', name: 'HR', position: 3, root: false, grants: { members: 'read' } },
        ])
      )
    );
    signInAs({ root: true });

    const { result } = renderHook(() => useAccessRolesQuery(), { wrapper: setup().wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.name).toBe('HR'));
  });

  it('sends nothing for a member who is not root', async () => {
    let requested = false;
    server.use(
      http.get(`${API}/admin/access/overrides`, () => {
        requested = true;
        return HttpResponse.json({ members: [] });
      })
    );
    signInAs({ permissions: { members: 'manage' } });

    const { result } = renderHook(() => useOverridesListQuery(), { wrapper: setup().wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe('idle');
    expect(requested).toBe(false);
  });

  it('reads one member with the profile and the sources', async () => {
    server.use(
      http.get(`${API}/admin/access/members/m1/effective`, () =>
        HttpResponse.json({
          memberId: 'm1',
          username: 'ada',
          displayName: 'Ada',
          avatar: null,
          root: false,
          access: { members: { level: 'read', source: { type: 'role', roleId: 'r1' } } },
        })
      )
    );
    signInAs({ root: true });

    const { result } = renderHook(() => useMemberEffectiveQuery('m1'), {
      wrapper: setup().wrapper,
    });

    await waitFor(() => expect(result.current.data?.displayName).toBe('Ada'));
  });
});

describe('access mutations', () => {
  it('replaces a role grants with a PUT and refreshes the roles', async () => {
    let body: unknown;
    let rolesFetches = 0;
    server.use(
      http.put(`${API}/admin/access/roles/r1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ roleId: 'r1', grants: { members: 'read' } });
      }),
      http.get(`${API}/admin/access/roles`, () => {
        rolesFetches += 1;
        return HttpResponse.json([]);
      })
    );
    signInAs({ root: true });
    const { wrapper } = setup();

    const roles = renderHook(() => useAccessRolesQuery(), { wrapper });
    const mutation = renderHook(() => useSetRoleGrantsMutation(), { wrapper });
    await waitFor(() => expect(rolesFetches).toBe(1));

    await act(() =>
      mutation.result.current.mutateAsync({ roleId: 'r1', grants: { members: 'read' } })
    );

    expect(body).toEqual({ grants: { members: 'read' } });
    await waitFor(() => expect(rolesFetches).toBe(2));
    expect(roles.result.current.isError).toBe(false);
  });

  it('replaces a member overrides with a PUT', async () => {
    let body: unknown;
    server.use(
      http.put(`${API}/admin/access/members/m1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ memberId: 'm1', overrides: { messages: 'none' } });
      })
    );
    signInAs({ root: true });

    const { result } = renderHook(() => useSetMemberOverridesMutation('m1'), {
      wrapper: setup().wrapper,
    });
    await act(() => result.current.mutateAsync({ messages: 'none' }));

    expect(body).toEqual({ grants: { messages: 'none' } });
  });
});
