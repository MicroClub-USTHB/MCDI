import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ACCESS_LEVELS, ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import { server } from '../../../setup';
import { RoleEditor } from '@/features/access/components/RoleEditor';
import type { AccessCatalogDto, AccessRoleDto } from '@/features/access';

const API = 'http://localhost:3000/api';

const catalog: AccessCatalogDto = {
  resources: ACCESS_RESOURCES.map((key) => ({ key, description: `About ${key}` })),
  levels: ACCESS_LEVELS.map((key) => ({ key, description: key })),
};

const role = (overrides: Partial<AccessRoleDto> = {}): AccessRoleDto => ({
  id: 'r-hr',
  name: 'HR',
  position: 3,
  root: false,
  grants: { members: 'read', audit: 'read' },
  ...overrides,
});

function renderEditor(value: AccessRoleDto) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<RoleEditor role={value} catalog={catalog} />, { wrapper });
}

const level = (resource: string, name: string) =>
  within(screen.getByRole('group', { name: resource })).getByRole('radio', { name });

describe('RoleEditor', () => {
  it('shows one control per resource with the role grants and the catalog description', () => {
    renderEditor(role());

    expect(level('Members', 'Read')).toBeChecked();
    expect(level('Messages', 'None')).toBeChecked();
    expect(screen.getByText('About members')).toBeInTheDocument();
    expect(screen.getAllByRole('group').length).toBe(ACCESS_RESOURCES.length);
  });

  it('locks a root role', () => {
    renderEditor(role({ root: true, grants: {} }));

    expect(screen.getByText(/full access/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('saves the full set without none, then reports it', async () => {
    let body: unknown;
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ roleId: 'r-hr', grants: {} });
      })
    );
    renderEditor(role());

    await userEvent.click(level('Projects', 'Write'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(body).toEqual({ grants: { members: 'read', audit: 'read', projects: 'write' } })
    );
  });

  it('keeps Save off until something changes, and Discard puts the form back', async () => {
    renderEditor(role());
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();

    await userEvent.click(level('Projects', 'Read'));
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: /discard/i }));
    expect(level('Projects', 'None')).toBeChecked();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('asks before lowering a level and sends nothing until confirmed', async () => {
    let saved = false;
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, () => {
        saved = true;
        return HttpResponse.json({ roleId: 'r-hr', grants: {} });
      })
    );
    renderEditor(role());

    await userEvent.click(level('Members', 'None'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/lose this access immediately/i)).toBeInTheDocument();
    expect(saved).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /^save changes$/i }));
    await waitFor(() => expect(saved).toBe(true));
  });

  it('does not ask when only raising a level', async () => {
    let saved = false;
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, () => {
        saved = true;
        return HttpResponse.json({ roleId: 'r-hr', grants: {} });
      })
    );
    renderEditor(role());

    await userEvent.click(level('Members', 'Manage'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(saved).toBe(true));
    expect(screen.queryByText(/lose this access immediately/i)).not.toBeInTheDocument();
  });

  it('warns about a grant that cannot be reached in the panel', async () => {
    renderEditor(role({ grants: { channels: 'read' } }));
    expect(
      screen.getByText('Channels needs Servers: read to be reachable in the panel')
    ).toBeInTheDocument();

    await userEvent.click(level('Servers', 'Read'));
    expect(screen.queryByText(/needs Servers: read/)).not.toBeInTheDocument();
  });

  it('shows the API message and keeps the form when a save is refused', async () => {
    server.use(
      http.put(`${API}/admin/access/roles/r-hr`, () =>
        HttpResponse.json({ message: 'Unknown resource', statusCode: 400 }, { status: 400 })
      )
    );
    renderEditor(role());

    await userEvent.click(level('Projects', 'Read'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(level('Projects', 'Read')).toBeChecked());
    expect(screen.getByRole('button', { name: /save/i })).toBeEnabled();
  });
});
