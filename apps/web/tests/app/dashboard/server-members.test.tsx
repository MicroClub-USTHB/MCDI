import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/servers/server-main/members',
  useSearchParams: () => new URLSearchParams(),
}));

import { MembersView } from '@/app/dashboard/members/members-view';

const API_URL = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("A server's member roster", () => {
  it('lists only the members of the server in the URL, with no server filter', async () => {
    let listUrl: URL | null = null;
    server.use(
      http.get(`${API_URL}/servers`, () => HttpResponse.json([])),
      http.get(`${API_URL}/admin/stats/roles`, () =>
        HttpResponse.json({
          serverId: 'server-main',
          serverName: 'Main',
          totalMembers: 0,
          roles: [],
        })
      ),
      http.get(`${API_URL}/admin/members`, ({ request }) => {
        listUrl = new URL(request.url);
        return HttpResponse.json({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 1 });
      })
    );

    render(<MembersView serverId="server-main" />, { wrapper });

    await waitFor(() => expect(listUrl?.searchParams.getAll('serverId')).toEqual(['server-main']));
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Servers' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Roles' })).toBeInTheDocument();
  });
});
