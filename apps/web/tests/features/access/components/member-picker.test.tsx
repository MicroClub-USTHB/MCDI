import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, type ResponseResolver } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../setup';
import { MemberPicker } from '@/features/access/components/MemberPicker';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function memberDto(id: string, username: string, globalName: string | null) {
  return {
    memberId: id,
    username,
    globalName,
    avatar: null,
    isClubMember: true,
    serverCount: 1,
    servers: [],
  };
}

function membersPage(
  data: ReturnType<typeof memberDto>[],
  extra: { total?: number; totalPages?: number; page?: number } = {}
) {
  return HttpResponse.json({
    data,
    total: extra.total ?? data.length,
    page: extra.page ?? 1,
    limit: 25,
    totalPages: extra.totalPages ?? 1,
  });
}

function mockMembers(handler: ResponseResolver) {
  server.use(
    http.get(`${API}/admin/members`, handler),
    // The picker badges members who already have an override; an unmocked request here
    // would reach the real API, 401 and clear auth mid-test.
    http.get(`${API}/admin/access/overrides`, () => HttpResponse.json({ members: [] }))
  );
}

describe('MemberPicker', () => {
  it('lists the members and reports the selected one', async () => {
    mockMembers(() =>
      membersPage([
        memberDto('m-ada', 'ada', 'Ada Lovelace'),
        memberDto('m-grace', 'grace', 'Grace'),
      ])
    );
    const onSelect = vi.fn();
    render(<MemberPicker selectedId={null} onSelect={onSelect} />, { wrapper });

    const list = await screen.findByRole('list', { name: 'Members' });
    expect(within(list).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(list).getByText('@grace')).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('button', { name: /ada lovelace/i }));
    expect(onSelect).toHaveBeenCalledWith('m-ada');
  });

  it('marks the selected member and searches the server as you type', async () => {
    let requestedUrl = '';
    mockMembers(({ request }) => {
      requestedUrl = new URL(request.url).toString();
      return membersPage([memberDto('m-ada', 'ada', 'Ada Lovelace')]);
    });
    const onSelect = vi.fn();
    render(<MemberPicker selectedId="m-ada" onSelect={onSelect} />, { wrapper });

    const list = await screen.findByRole('list', { name: 'Members' });
    expect(within(list).getByRole('button', { name: /ada lovelace/i })).toHaveAttribute(
      'aria-current',
      'true'
    );

    await userEvent.type(screen.getByRole('searchbox', { name: /search members/i }), 'grace');
    await waitFor(() => expect(new URL(requestedUrl).searchParams.get('search')).toBe('grace'), {
      timeout: 2000,
    });
  });

  it('flags members who already have an override', async () => {
    mockMembers(() =>
      membersPage([memberDto('m-ada', 'ada', 'Ada'), memberDto('m-grace', 'grace', 'Grace')])
    );
    server.use(
      http.get(`${API}/admin/access/overrides`, () =>
        HttpResponse.json({
          members: [
            {
              memberId: 'm-ada',
              username: 'ada',
              displayName: 'Ada',
              avatar: null,
              root: false,
              overrides: { messages: 'none' },
            },
          ],
        })
      )
    );
    render(<MemberPicker selectedId={null} onSelect={vi.fn()} />, { wrapper });

    const list = await screen.findByRole('list', { name: 'Members' });
    const rows = within(list).getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Override')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Override')).not.toBeInTheDocument();
  });

  it('pages through the members', async () => {
    mockMembers(({ request }) => {
      const page = new URL(request.url).searchParams.get('page');
      if (page === '2') return membersPage([memberDto('m-bob', 'bob', 'Bob')], { page: 2 });
      return membersPage([memberDto('m-ada', 'ada', 'Ada')], { total: 2, totalPages: 2 });
    });
    render(<MemberPicker selectedId={null} onSelect={vi.fn()} />, { wrapper });

    const list = await screen.findByRole('list', { name: 'Members' });
    expect(within(list).getByText('Ada')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    expect(
      await within(await screen.findByRole('list', { name: 'Members' })).findByText('Bob')
    ).toBeInTheDocument();
  });

  it('offers a retry when the member list fails to load', async () => {
    let fail = true;
    mockMembers(() => {
      if (fail) return HttpResponse.json({ message: 'boom' }, { status: 500 });
      return membersPage([memberDto('m-ada', 'ada', 'Ada')]);
    });
    render(<MemberPicker selectedId={null} onSelect={vi.fn()} />, { wrapper });

    const retry = await screen.findByRole('button', { name: /retry/i });
    fail = false;
    await userEvent.click(retry);
    expect(await screen.findByText('Ada')).toBeInTheDocument();
  });
});
