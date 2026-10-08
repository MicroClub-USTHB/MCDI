import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import { ProjectForm } from '@/features/projects/components/ProjectForm';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function serveServers() {
  server.use(
    http.get(`${API}/servers`, () =>
      HttpResponse.json([{ id: 'srv_1', name: 'MicroClub', isActive: true }])
    )
  );
}

describe('ProjectForm server access', () => {
  it('omits the whole server field without servers:read, heading and counter included', async () => {
    serveServers();
    signInAs({ permissions: { projects: 'write' } });
    render(<ProjectForm mode="create" onSubmit={vi.fn()} />, { wrapper });

    expect((await screen.findAllByText('Scopes')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Server access')).not.toBeInTheDocument();
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it('shows the server list with servers:read', async () => {
    serveServers();
    signInAs({ permissions: { projects: 'write', servers: 'read' } });
    render(<ProjectForm mode="create" onSubmit={vi.fn()} />, { wrapper });

    expect(await screen.findByText('Server access')).toBeInTheDocument();
    expect(await screen.findByLabelText('Grant access to MicroClub')).toBeInTheDocument();
  });
});
