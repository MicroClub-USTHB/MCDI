import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { ProjectAccessView } from '@/app/dashboard/projects/[id]/access/access-view';
import { ProjectDetailView } from '@/app/dashboard/projects/[id]/project-detail-view';

const API_URL = 'http://localhost:3000/api';

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
    http.get(`${API_URL}/admin/projects/proj_1`, () => HttpResponse.json(project)),
    http.get(`${API_URL}/admin/projects/proj_1/api-key`, () =>
      HttpResponse.json({
        projectId: 'proj_1',
        projectName: 'Website',
        apiKeyPrefix: 'pk_abc',
        apiKeyCreatedAt: '2026-08-01T10:00:00.000Z',
        apiKeyLastUsedAt: null,
        isActive: true,
      })
    ),
    http.get(`${API_URL}/servers`, () => HttpResponse.json([])),
    http.get(`${API_URL}/admin/projects/access/matrix`, () => HttpResponse.json([])),
    http.get(`${API_URL}/admin/projects/access/audit`, () => HttpResponse.json([]))
  );
});

describe('project pages', () => {
  it('keeps the key and settings on the project page, without server access', async () => {
    render(<ProjectDetailView id="proj_1" />, { wrapper });

    expect(await screen.findByRole('heading', { name: 'Website' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'API key' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Redirect URIs' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Server access' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Access audit log' })).toBeNull();
  });

  it('gives server access and its audit log their own page', async () => {
    render(<ProjectAccessView projectId="proj_1" />, { wrapper });

    expect(await screen.findByRole('heading', { name: 'Server access' })).toBeInTheDocument();
    expect(await screen.findByText('Website')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Access audit log' })).toBeInTheDocument();
  });
});
