import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import MonitoringPage from '@/app/dashboard/monitoring/page';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('MonitoringPage access', () => {
  it('shows only the audit log to a member who can read audit but not monitoring', () => {
    server.use(
      http.get(`${API}/admin/audit/logs`, () =>
        HttpResponse.json({ logs: [], total: 0, limit: 50 })
      )
    );
    signInAs({ permissions: { audit: 'read' } });
    render(<MonitoringPage />, { wrapper });

    expect(screen.getByRole('heading', { name: 'Audit logs' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'System health' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'API usage' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Recent authentication failures' })
    ).not.toBeInTheDocument();
  });

  it('shows everything except the audit log to a member who can read monitoring only', () => {
    signInAs({ permissions: { monitoring: 'read' } });
    render(<MonitoringPage />, { wrapper });

    expect(screen.getByRole('heading', { name: 'System health' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'API usage' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Audit logs' })).not.toBeInTheDocument();
  });

  it('hides the actor filter without members:read, and the project filter without projects:read', () => {
    signInAs({ permissions: { audit: 'read', monitoring: 'read' } });
    render(<MonitoringPage />, { wrapper });

    expect(screen.queryByText('All actors')).not.toBeInTheDocument();
    expect(screen.queryByText('All projects')).not.toBeInTheDocument();
  });

  it('shows the actor and project filters when the member can read members and projects', () => {
    signInAs({
      permissions: { audit: 'read', monitoring: 'read', members: 'read', projects: 'read' },
    });
    render(<MonitoringPage />, { wrapper });

    expect(screen.getByText('All actors')).toBeInTheDocument();
    expect(screen.getByText('All projects')).toBeInTheDocument();
  });
});
