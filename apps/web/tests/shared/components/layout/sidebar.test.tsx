import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../setup';

const nav = vi.hoisted(() => ({ pathname: '/dashboard/members', push: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
}));

vi.mock('@/features/auth/components/LogoutButton', () => ({
  LogoutButton: () => (
    <button type="button" aria-label="Log out">
      Log out
    </button>
  ),
}));

import { Sidebar } from '@/shared/components/layout/sidebar';
import { useAuthStore } from '@/features/auth/stores/auth';
import { readLastContextId, rememberContextId } from '@/shared/lib/last-context';

const API_URL = 'http://localhost:3000/api';

function serverDto(id: string, name: string) {
  return {
    id,
    name,
    icon: null,
    type: 'main',
    isMain: false,
    isActive: true,
    syncFrequencyHours: 24,
    defaultPermissionPolicy: 'custom',
    disabledReason: null,
    syncedAt: null,
    lastSyncAt: null,
    botConnected: true,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderSidebar(props: { open?: boolean; onClose?: () => void } = {}) {
  return render(<Sidebar open={props.open ?? true} onClose={props.onClose ?? (() => {})} />, {
    wrapper,
  });
}

function group(label: string) {
  return within(screen.getByRole('group', { name: label }));
}

beforeEach(() => {
  nav.pathname = '/dashboard/members';
  nav.push.mockClear();
  server.use(
    http.get(`${API_URL}/servers`, () =>
      HttpResponse.json([serverDto('srv_1', 'MicroClub'), serverDto('srv_2', 'Events')])
    ),
    http.get(`${API_URL}/admin/projects`, () =>
      HttpResponse.json([
        { id: 'proj_1', name: 'Website' },
        { id: 'proj_2', name: 'Bot' },
      ])
    )
  );
});

describe('Sidebar', () => {
  it('groups the navigation into overview, Discord, projects and system', () => {
    renderSidebar();

    expect(group('Overview').getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(group('Overview').getByRole('link', { name: 'Members' })).toBeInTheDocument();
    expect(group('Overview').getByRole('link', { name: 'Stats' })).toBeInTheDocument();
    expect(group('Projects').getByRole('link', { name: 'All projects' })).toBeInTheDocument();
    expect(group('System').getByRole('link', { name: 'Monitoring' })).toBeInTheDocument();
    expect(group('System').getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('marks the item matching the current route as the current page', () => {
    renderSidebar();

    expect(group('Overview').getByRole('link', { name: 'Members' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(group('Overview').getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('points the Discord sub-items at the server in the URL and marks the current one', async () => {
    nav.pathname = '/dashboard/servers/srv_2/roles/42';
    renderSidebar();

    const discord = group('Discord');
    expect(await discord.findByRole('combobox', { name: 'Select a server' })).toHaveTextContent(
      'Events'
    );
    expect(discord.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/dashboard/servers/srv_2'
    );
    expect(discord.getByRole('link', { name: 'Channels' })).toHaveAttribute(
      'href',
      '/dashboard/servers/srv_2/channels'
    );
    expect(discord.getByRole('link', { name: 'Roles' })).toHaveAttribute('aria-current', 'page');
  });

  it('remembers the server being viewed for next time', async () => {
    nav.pathname = '/dashboard/servers/srv_2/sync';
    renderSidebar();

    await waitFor(() => expect(readLastContextId('server')).toBe('srv_2'));
  });

  it('uses the last-used server when the page is not about a server', async () => {
    rememberContextId('server', 'srv_2');
    renderSidebar();

    expect(
      await group('Discord').findByRole('combobox', { name: 'Select a server' })
    ).toHaveTextContent('Events');
    expect(group('Discord').getByRole('link', { name: 'Sync' })).toHaveAttribute(
      'href',
      '/dashboard/servers/srv_2/sync'
    );
  });

  it('switching server keeps the same page', async () => {
    nav.pathname = '/dashboard/servers/srv_1/channels';
    renderSidebar();

    await userEvent.click(
      await group('Discord').findByRole('combobox', { name: 'Select a server' })
    );
    await userEvent.click(await screen.findByRole('option', { name: 'Events' }));

    expect(nav.push).toHaveBeenCalledWith('/dashboard/servers/srv_2/channels');
  });

  it('offers the full server list from the switcher', async () => {
    renderSidebar();

    await userEvent.click(
      await group('Discord').findByRole('combobox', { name: 'Select a server' })
    );
    await userEvent.click(await screen.findByRole('option', { name: 'All servers' }));

    expect(nav.push).toHaveBeenCalledWith('/dashboard/servers');
  });

  it('points the project sub-items at the chosen project', async () => {
    nav.pathname = '/dashboard/projects/proj_2/webhooks';
    renderSidebar();

    const projects = group('Projects');
    expect(await projects.findByRole('combobox', { name: 'Select a project' })).toHaveTextContent(
      'Bot'
    );
    expect(projects.getByRole('link', { name: 'Server access' })).toHaveAttribute(
      'href',
      '/dashboard/projects/proj_2/access'
    );
    expect(projects.getByRole('link', { name: 'Webhooks' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(projects.getByRole('link', { name: 'All projects' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('calls onClose when the mobile close button is clicked', async () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });

    await userEvent.click(screen.getByRole('button', { name: /close sidebar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    const { container } = renderSidebar({ onClose });

    const backdrop = container.querySelector('[aria-hidden="true"].fixed.inset-0');
    expect(backdrop).not.toBeNull();
    await userEvent.click(backdrop as Element);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed while open', async () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus to the close button when it opens', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /close sidebar/i })).toHaveFocus();
  });

  describe('account footer', () => {
    afterEach(() => {
      useAuthStore.setState({ user: null, isAuthenticated: false });
    });

    it('is omitted when no user is signed in', () => {
      useAuthStore.setState({ user: null });
      renderSidebar();
      expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    });

    it('shows the signed-in user and a logout control', () => {
      useAuthStore.setState({
        user: {
          id: '1',
          username: 'dev_user',
          name: 'Dev User',
          email: 'dev@example.com',
          avatar: null,
          isSystemAdmin: true,
        },
      });
      renderSidebar();

      expect(screen.getByText('Dev User')).toBeInTheDocument();
      expect(screen.getByText('dev@example.com')).toBeInTheDocument();
      expect(screen.getByText('DU')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    });
  });
});
