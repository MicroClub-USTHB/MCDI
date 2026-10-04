import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { server } from '../../setup';
import { RoleDetailView } from '@/app/dashboard/servers/[id]/roles/[roleId]/role-detail-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const SERVER_ID = 'srv_1';
const DEV_ROLE = 'role_dev';
const EXEC_ROLE = 'role_exec';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const roleStats = {
  serverId: SERVER_ID,
  serverName: 'Main Server',
  totalMembers: 100,
  roles: [
    // exec ranks highest (lowest hierarchyLevel) → treated as the protected role
    {
      roleId: EXEC_ROLE,
      roleName: 'Executive',
      memberCount: 4,
      percentage: 4,
      hierarchyLevel: 1,
      color: null,
    },
    {
      roleId: DEV_ROLE,
      roleName: 'Developer',
      memberCount: 40,
      percentage: 40,
      hierarchyLevel: 5,
      color: null,
    },
  ],
};

function permsResponse(roleId: string, ids: number[]) {
  return {
    roleId,
    roleName: roleId === DEV_ROLE ? 'Developer' : 'Executive',
    serverId: SERVER_ID,
    permissions: ids.map((id) => ({ id, key: `PERM_${id}` })),
  };
}

describe('Role detail — bulk permission editing', () => {
  let impactCalls = 0;
  let assignCalls: Array<{ permissionIds: number[] }>;
  let deleteCalls: number[];

  beforeEach(() => {
    impactCalls = 0;
    assignCalls = [];
    deleteCalls = [];
    // Developer starts with only KICK_MEMBERS (id 2).
    let devPerms = [2];

    server.use(
      http.get('*/api/servers', () =>
        HttpResponse.json([
          {
            id: SERVER_ID,
            name: 'Main Server',
            icon: null,
            type: 'main',
            isMain: true,
            isActive: true,
            syncFrequencyHours: 24,
            defaultPermissionPolicy: 'allow_all',
            disabledReason: null,
            syncedAt: null,
            lastSyncAt: null,
            botConnected: true,
          },
        ])
      ),
      http.get(`*/api/admin/stats/roles`, () => HttpResponse.json(roleStats)),
      http.get(
        `*/api/permissions/admin/servers/${SERVER_ID}/roles/:roleId/permissions`,
        ({ params }) => {
          const roleId = params.roleId as string;
          return HttpResponse.json(
            permsResponse(roleId, roleId === DEV_ROLE ? devPerms : [1, 2, 3])
          );
        }
      ),
      http.post(
        `*/api/permissions/admin/servers/${SERVER_ID}/roles/${DEV_ROLE}/impact`,
        async () => {
          impactCalls += 1;
          return HttpResponse.json({ affectedMembers: 12, memberIds: [], roleHolders: 40 });
        }
      ),
      http.post(
        `*/api/permissions/admin/servers/${SERVER_ID}/roles/${DEV_ROLE}/permissions`,
        async ({ request }) => {
          const body = (await request.json()) as { permissionIds: number[] };
          assignCalls.push(body);
          devPerms = [...new Set([...devPerms, ...body.permissionIds])];
          return HttpResponse.json(permsResponse(DEV_ROLE, devPerms));
        }
      ),
      http.delete(
        `*/api/permissions/admin/servers/${SERVER_ID}/roles/${DEV_ROLE}/permissions/:permissionId`,
        ({ params }) => {
          const id = Number(params.permissionId);
          deleteCalls.push(id);
          devPerms = devPerms.filter((p) => p !== id);
          return new HttpResponse(null, { status: 204 });
        }
      )
    );
  });

  it('previews impact for a staged change and only writes on Apply', async () => {
    const user = userEvent.setup();
    render(<RoleDetailView roleId={DEV_ROLE} serverId={SERVER_ID} />, { wrapper });

    const addSendMessages = await screen.findByRole('checkbox', { name: 'Add SEND_MESSAGES' });
    expect(impactCalls).toBe(0);

    await user.click(addSendMessages);

    expect(await screen.findByText('1 to add')).toBeInTheDocument();
    expect(await screen.findByText(/12 members will gain these permissions/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Apply 1 change/ })).toBeInTheDocument();
    await waitFor(() => expect(impactCalls).toBe(1));
    expect(assignCalls).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Apply 1 change/ }));

    await waitFor(() => expect(assignCalls).toEqual([{ permissionIds: [12] }]));
    await waitFor(() => expect(screen.queryByText('1 to add')).not.toBeInTheDocument());
  }, 15000);

  it('applies several staged add/remove changes in one batch', async () => {
    const user = userEvent.setup();
    render(<RoleDetailView roleId={DEV_ROLE} serverId={SERVER_ID} />, { wrapper });

    await user.click(await screen.findByRole('checkbox', { name: 'Add SEND_MESSAGES' }));
    await user.click(screen.getByRole('checkbox', { name: 'Remove KICK_MEMBERS' }));

    expect(await screen.findByText('1 to add · 1 to remove')).toBeInTheDocument();
    expect(assignCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /Apply 2 changes/ }));

    await waitFor(() => expect(assignCalls).toEqual([{ permissionIds: [12] }]));
    await waitFor(() => expect(deleteCalls).toEqual([2]));
    await waitFor(() =>
      expect(screen.queryByText('1 to add · 1 to remove')).not.toBeInTheDocument()
    );
  }, 15000);

  it('Discard drops staged changes without writing', async () => {
    const user = userEvent.setup();
    render(<RoleDetailView roleId={DEV_ROLE} serverId={SERVER_ID} />, { wrapper });

    await user.click(await screen.findByRole('checkbox', { name: 'Add SEND_MESSAGES' }));
    await screen.findByRole('button', { name: 'Discard' });
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument()
    );
    expect(assignCalls).toHaveLength(0);
    expect(screen.getByRole('checkbox', { name: 'Add SEND_MESSAGES' })).toBeInTheDocument();
  }, 15000);

  it('locks the matrix for the protected executive role', async () => {
    render(<RoleDetailView roleId={EXEC_ROLE} serverId={SERVER_ID} />, { wrapper });

    expect(await screen.findByText(/Executive role — permissions are locked/)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((cb) => expect(cb).toBeDisabled());
    expect(screen.queryByText(/to add/)).not.toBeInTheDocument();
  }, 15000);
});
