import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { signInAs } from '../../../helpers/auth';

const nav = vi.hoisted(() => ({ pathname: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

import { RequireAccess } from '@/shared/components/layout/require-access';

function renderGuard() {
  return render(
    <RequireAccess>
      <p>the page</p>
    </RequireAccess>
  );
}

beforeEach(() => {
  nav.pathname = '/dashboard/members';
});

describe('RequireAccess', () => {
  it('renders the page when the member meets the route requirement', () => {
    signInAs({ permissions: { members: 'read' } });
    renderGuard();
    expect(screen.getByText('the page')).toBeInTheDocument();
  });

  it('names what the page needs and links to a page the member can use', () => {
    signInAs({ permissions: { stats: 'read' } });
    renderGuard();

    expect(screen.queryByText('the page')).not.toBeInTheDocument();
    expect(screen.getByText(/don.t have access to this page/i)).toBeInTheDocument();
    expect(screen.getByText(/Members: read/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to the dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard'
    );
  });

  it('denies a route that is not in the table', () => {
    signInAs({ root: true });
    nav.pathname = '/dashboard/not-a-page';
    renderGuard();
    expect(screen.queryByText('the page')).not.toBeInTheDocument();
    expect(screen.getByText(/don.t have access to this page/i)).toBeInTheDocument();
  });

  it('shows "No access yet" at the dashboard to a member with no access, and offers Settings', () => {
    signInAs({ permissions: {} });
    nav.pathname = '/dashboard';
    renderGuard();

    expect(screen.getByText('No access yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/dashboard/settings'
    );
  });

  it('lets any signed-in member open Settings', () => {
    signInAs({ permissions: {} });
    nav.pathname = '/dashboard/settings';
    renderGuard();
    expect(screen.getByText('the page')).toBeInTheDocument();
  });
});
