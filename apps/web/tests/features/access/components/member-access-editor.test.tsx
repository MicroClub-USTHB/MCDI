import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { MemberAccessEditor } from '@/features/access/components/MemberAccessEditor';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const effective = (root = false) => ({
  memberId: 'm1',
  username: 'ada',
  displayName: 'Ada',
  avatar: null,
  root,
  access: Object.fromEntries(
    ACCESS_RESOURCES.map((resource) => [
      resource,
      root
        ? { level: 'manage', source: { type: 'root' } }
        : resource === 'members'
          ? { level: 'write', source: { type: 'role', roleId: 'r-hr' } }
          : resource === 'messages'
            ? { level: 'read', source: { type: 'override' } }
            : { level: 'none', source: { type: 'none' } },
    ])
  ),
});

function mockMember(options: { root?: boolean; overrides?: Record<string, string> } = {}) {
  server.use(
    http.get(`${API}/admin/access/members/m1/effective`, () =>
      HttpResponse.json(effective(options.root))
    ),
    http.get(`${API}/admin/access/members/m1`, () =>
      HttpResponse.json({ memberId: 'm1', overrides: options.overrides ?? { messages: 'read' } })
    ),
    http.get(`${API}/admin/access/roles`, () =>
      HttpResponse.json([
        { id: 'r-hr', name: 'HR', position: 3, root: false, grants: { members: 'write' } },
      ])
    ),
    http.get(`${API}/admin/access/catalog`, () =>
      HttpResponse.json({
        resources: ACCESS_RESOURCES.map((key) => ({ key, description: `About ${key}` })),
        levels: [],
      })
    )
  );
}

const control = (resource: string, name: string) =>
  within(screen.getByRole('group', { name: resource })).getByRole('radio', { name });

describe('MemberAccessEditor', () => {
  it('shows the effective level with its source and the current overrides', async () => {
    mockMember();
    render(<MemberAccessEditor memberId="m1" />, { wrapper });

    expect(await screen.findByText('Ada')).toBeInTheDocument();
    expect(screen.getByText(/Effective: write · Role: HR/)).toBeInTheDocument();
    expect(screen.getByText(/Effective: read · Override/)).toBeInTheDocument();
    expect(control('Members', 'Inherit')).toBeChecked();
    expect(control('Messages', 'Read')).toBeChecked();
  });

  it('locks a member who is root', async () => {
    mockMember({ root: true });
    render(<MemberAccessEditor memberId="m1" />, { wrapper });

    expect(await screen.findByText(/cannot be changed/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('saves the full override set and leaves inherited resources out', async () => {
    let body: unknown;
    mockMember();
    server.use(
      http.put(`${API}/admin/access/members/m1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ memberId: 'm1', overrides: {} });
      })
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(control('Projects', 'Manage'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(body).toEqual({ grants: { messages: 'read', projects: 'manage' } }));
  });

  it('sends an empty set when every override is set back to inherit', async () => {
    let body: unknown;
    mockMember();
    server.use(
      http.put(`${API}/admin/access/members/m1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ memberId: 'm1', overrides: {} });
      })
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(control('Messages', 'Inherit'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(body).toEqual({ grants: {} }));
  });

  it('asks before setting an override below what the member holds now', async () => {
    let saved = false;
    mockMember();
    server.use(
      http.put(`${API}/admin/access/members/m1`, () => {
        saved = true;
        return HttpResponse.json({ memberId: 'm1', overrides: {} });
      })
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });
    await screen.findByText('Ada');

    await userEvent.click(control('Members', 'Read'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/lose this access immediately/i)).toBeInTheDocument();
    expect(saved).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /^save changes$/i }));
    await waitFor(() => expect(saved).toBe(true));
  });

  it('shows a not-found state for an unknown member', async () => {
    server.use(
      http.get(`${API}/admin/access/members/m1/effective`, () =>
        HttpResponse.json({ message: 'Member not found' }, { status: 404 })
      ),
      http.get(`${API}/admin/access/members/m1`, () =>
        HttpResponse.json({ message: 'Member not found' }, { status: 404 })
      ),
      http.get(`${API}/admin/access/roles`, () => HttpResponse.json([])),
      http.get(`${API}/admin/access/catalog`, () =>
        HttpResponse.json({ resources: [], levels: [] })
      )
    );
    render(<MemberAccessEditor memberId="m1" />, { wrapper });

    expect(await screen.findByText(/member not found/i)).toBeInTheDocument();
  });
});
