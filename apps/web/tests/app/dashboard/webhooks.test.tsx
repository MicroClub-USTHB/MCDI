import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { WebhooksView } from '@/app/dashboard/projects/[id]/webhooks/webhooks-view';
import { useToastStore } from '@/shared/stores/toast';

const API_URL = 'http://localhost:3000/api';

function projectDto(id: string, name: string) {
  return {
    id,
    name,
    description: null,
    isInternal: false,
    webhookUrl: null,
    apiKeyPrefix: 'mcdi_live_abc',
    apiKeyCreatedAt: '2026-08-01T10:00:00.000Z',
    apiKeyLastUsedAt: null,
    isActive: true,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  };
}

function webhookDto(id: string, name: string, usageCount: number) {
  return {
    id,
    name,
    channelId: '234567890123456789',
    channelName: 'deployments',
    serverId: '123456789012345678',
    serverName: 'MicroClub',
    createdAt: '2026-08-01T10:00:00.000Z',
    usageCount,
    lastUsedAt: null,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function withProjects(...projects: ReturnType<typeof projectDto>[]) {
  server.use(http.get(`${API_URL}/admin/projects`, () => HttpResponse.json(projects)));
}

afterEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('Webhooks page', () => {
  it("lists the project's webhooks and details the first one", async () => {
    withProjects(projectDto('proj_1', 'Website'), projectDto('proj_2', 'Bot'));
    server.use(
      http.get(`${API_URL}/admin/projects/proj_1/webhooks`, () =>
        HttpResponse.json({
          webhooks: [webhookDto('wh_1', 'Deploys', 12), webhookDto('wh_2', 'Alerts', 3)],
          total: 2,
          limit: 100,
          offset: 0,
        })
      )
    );

    render(<WebhooksView projectId="proj_1" />, { wrapper });

    expect(await screen.findByRole('button', { name: 'Deploys' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deploys' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Select a project' })).toBeNull();
  });

  it('shows the details of the webhook picked in the table', async () => {
    withProjects(projectDto('proj_1', 'Website'));
    server.use(
      http.get(`${API_URL}/admin/projects/proj_1/webhooks`, () =>
        HttpResponse.json({
          webhooks: [webhookDto('wh_1', 'Deploys', 12), webhookDto('wh_2', 'Alerts', 3)],
          total: 2,
          limit: 100,
          offset: 0,
        })
      )
    );

    render(<WebhooksView projectId="proj_1" />, { wrapper });
    await userEvent.click(await screen.findByRole('button', { name: 'Alerts' }));

    expect(screen.getByRole('heading', { name: 'Alerts' })).toBeInTheDocument();
  });

  it('explains where webhooks come from when a project has none', async () => {
    withProjects(projectDto('proj_1', 'Website'));
    server.use(
      http.get(`${API_URL}/admin/projects/proj_1/webhooks`, () =>
        HttpResponse.json({ webhooks: [], total: 0, limit: 100, offset: 0 })
      )
    );

    render(<WebhooksView projectId="proj_1" />, { wrapper });

    expect(await screen.findByText('No webhooks')).toBeInTheDocument();
    expect(screen.getByText(/created by the project with its own API key/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('offers a retry when the webhooks fail to load', async () => {
    withProjects(projectDto('proj_1', 'Website'));
    server.use(
      http.get(`${API_URL}/admin/projects/proj_1/webhooks`, () =>
        HttpResponse.json({ statusCode: 500, message: 'Internal server error' }, { status: 500 })
      )
    );

    render(<WebhooksView projectId="proj_1" />, { wrapper });

    expect(await screen.findByText('Couldn’t load webhooks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('removes a deleted webhook from the list', async () => {
    let webhooks = [webhookDto('wh_1', 'Deploys', 12), webhookDto('wh_2', 'Alerts', 3)];
    withProjects(projectDto('proj_1', 'Website'));
    server.use(
      http.get(`${API_URL}/admin/projects/proj_1/webhooks`, () =>
        HttpResponse.json({ webhooks, total: webhooks.length, limit: 100, offset: 0 })
      ),
      http.delete(`${API_URL}/admin/webhooks/wh_1`, () => {
        webhooks = webhooks.filter((w) => w.id !== 'wh_1');
        return new HttpResponse(null, { status: 204 });
      })
    );

    render(<WebhooksView projectId="proj_1" />, { wrapper });
    const table = within(await screen.findByRole('table'));
    await screen.findByRole('heading', { name: 'Deploys' });

    await userEvent.click(screen.getByRole('button', { name: 'Delete webhook' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(table.queryByRole('button', { name: 'Deploys' })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('heading', { name: 'Alerts' })).toBeInTheDocument();
  });
});
