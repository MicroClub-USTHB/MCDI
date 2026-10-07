import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ProjectDetailView } from '@/app/dashboard/projects/[id]/project-detail-view';
import { ProjectsView } from '@/app/dashboard/projects/projects-view';

const API = 'http://localhost:3000/api';

const project = {
  id: 'proj_1',
  name: 'Website',
  description: null,
  isInternal: false,
  webhookUrl: null,
  apiKeyPrefix: 'pk_abc',
  apiKeyCreatedAt: '2026-08-01T10:00:00.000Z',
  apiKeyLastUsedAt: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  server.use(
    http.get(`${API}/admin/projects/proj_1`, () => HttpResponse.json(project)),
    http.get(`${API}/admin/projects`, () => HttpResponse.json([project])),
    http.get(`${API}/admin/projects/proj_1/api-key`, () =>
      HttpResponse.json({
        projectId: 'proj_1',
        projectName: 'Website',
        apiKeyPrefix: 'pk_abc',
        apiKeyCreatedAt: '2026-08-01T10:00:00.000Z',
        apiKeyLastUsedAt: null,
        isActive: true,
      })
    ),
    http.get(`${API}/servers`, () => HttpResponse.json([]))
  );
});

function renderDetail() {
  return render(<ProjectDetailView id="proj_1" />, { wrapper });
}

function renderList() {
  return render(<ProjectsView />, { wrapper });
}

describe('Project detail access', () => {
  it('shows a read-only member no edit, delete, key or redirect action', async () => {
    signInAs({ permissions: { projects: 'read', project_keys: 'read' } });
    renderDetail();
    await screen.findByRole('heading', { name: 'Website' });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /deactivate project/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reveal|details/i })).toBeInTheDocument();
  });

  it('omits the API key panel without project_keys:read', async () => {
    signInAs({ permissions: { projects: 'read' } });
    renderDetail();
    await screen.findByRole('heading', { name: 'Website' });
    expect(screen.queryByRole('heading', { name: 'API key' })).not.toBeInTheDocument();
  });

  it('gates each action by its own level', async () => {
    signInAs({ permissions: { projects: 'write', project_keys: 'write' } });
    renderDetail();
    await screen.findByRole('heading', { name: 'Website' });

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete project/i })).not.toBeInTheDocument();
    // Deactivating revokes the key (manage); the switch is not offered to a writer on an active project.
    expect(screen.queryByRole('switch', { name: /deactivate project/i })).not.toBeInTheDocument();
  });

  it('lets a manager of both delete and deactivate', async () => {
    signInAs({ permissions: { projects: 'manage', project_keys: 'manage' } });
    renderDetail();
    expect(await screen.findByRole('button', { name: /delete project/i })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /deactivate project/i })).toBeInTheDocument();
  });
});

describe('Projects list access', () => {
  it('hides Create project without projects:write', async () => {
    signInAs({ permissions: { projects: 'read' } });
    renderList();
    await screen.findByText('Website');
    expect(screen.queryByRole('button', { name: /create project/i })).not.toBeInTheDocument();
  });
});
