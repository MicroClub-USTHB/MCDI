import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACCESS_LEVELS, ACCESS_RESOURCES } from '@mcdi/contracts';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { AccessView } from '@/app/dashboard/access/access-view';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function mockAccess() {
  server.use(
    http.get(`${API}/admin/access/catalog`, () =>
      HttpResponse.json({
        resources: ACCESS_RESOURCES.map((key) => ({ key, description: `About ${key}` })),
        levels: ACCESS_LEVELS.map((key) => ({ key, description: key })),
      })
    ),
    http.get(`${API}/admin/access/roles`, () =>
      HttpResponse.json([
        { id: 'r-exec', name: 'Executive', position: 9, root: true, grants: {} },
        { id: 'r-hr', name: 'HR', position: 3, root: false, grants: { members: 'read' } },
        {
          id: 'r-dev',
          name: 'Dev Member',
          position: 2,
          root: false,
          grants: { projects: 'write' },
        },
      ])
    ),
    http.get(`${API}/admin/access/overrides`, () =>
      HttpResponse.json({
        members: [
          {
            memberId: 'm1',
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
}

describe('AccessView', () => {
  it('lists the roles, marks the root ones, and edits the selected one', async () => {
    mockAccess();
    render(<AccessView />, { wrapper });

    const list = await screen.findByRole('list', { name: 'Roles' });
    expect(within(list).getByText('Executive')).toBeInTheDocument();
    expect(within(list).getByText('Root')).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('button', { name: /HR/ }));
    expect(
      within(screen.getByRole('group', { name: 'Members' })).getByRole('radio', { name: 'Read' })
    ).toBeChecked();

    await userEvent.click(within(list).getByRole('button', { name: /Executive/ }));
    expect(screen.getByText(/cannot be edited here/i)).toBeInTheDocument();
  });

  it('shows the members with overrides on the second tab', async () => {
    mockAccess();
    render(<AccessView />, { wrapper });

    await userEvent.click(await screen.findByRole('tab', { name: /members with overrides/i }));
    expect(await screen.findByText('Messages: none')).toBeInTheDocument();
  });

  it('shows a retry when the roles cannot be loaded', async () => {
    mockAccess();
    server.use(
      http.get(`${API}/admin/access/roles`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    render(<AccessView />, { wrapper });

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Roles' })).not.toBeInTheDocument()
    );
  });
});
