import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import { RolesView } from '@/app/dashboard/servers/[id]/roles/roles-view';
import { RoleDetailView } from '@/app/dashboard/servers/[id]/roles/[roleId]/role-detail-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const SERVER_ID = 'srv_1';
const ROLE_ID = 'role_1';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const serverDto = {
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
};

const roleStats = {
  serverId: SERVER_ID,
  serverName: 'Main Server',
  totalMembers: 100,
  roles: [
    // exec ranks highest (lowest hierarchyLevel) → treated as the protected role
    {
      roleId: 'role_exec',
      roleName: 'Executive',
      memberCount: 4,
      percentage: 4,
      hierarchyLevel: 1,
      color: null,
    },
    {
      roleId: 'role_dev',
      roleName: 'Developer',
      memberCount: 40,
      percentage: 40,
      hierarchyLevel: 5,
      color: null,
    },
  ],
};

/** Handlers copied from roles-flow.test.tsx for the list view. */
function mockRolesView() {
  server.use(
    http.get('*/api/servers', () => HttpResponse.json([serverDto])),
    http.get('*/api/permissions/inheritance-rules', () => HttpResponse.json([])),
    http.get(
      `*/api/permissions/admin/servers/${SERVER_ID}/roles/:roleId/permissions`,
      ({ params }) =>
        HttpResponse.json({
          roleId: params.roleId,
          roleName: 'Role',
          serverId: SERVER_ID,
          permissions: [],
        })
    ),
    http.get('*/api/admin/stats/roles', ({ request }) =>
      new URL(request.url).searchParams.get('serverId') === SERVER_ID
        ? HttpResponse.json(roleStats)
        : HttpResponse.json({ message: 'unexpected server' }, { status: 400 })
    )
  );
}

/** Handlers copied from role-detail-flow.test.tsx for the detail view. */
function mockRoleDetail() {
  server.use(
    http.get('*/api/servers', () => HttpResponse.json([serverDto])),
    http.get('*/api/admin/stats/roles', () => HttpResponse.json(roleStats)),
    http.get(
      `*/api/permissions/admin/servers/${SERVER_ID}/roles/:roleId/permissions`,
      ({ params }) =>
        HttpResponse.json({
          roleId: params.roleId,
          roleName: 'Developer',
          serverId: SERVER_ID,
          permissions: [1, 2, 3].map((id) => ({ id, key: `PERM_${id}` })),
        })
    )
  );
}

function renderRolesView() {
  return render(<RolesView serverId={SERVER_ID} />, { wrapper });
}

function renderRoleDetail() {
  return render(<RoleDetailView serverId={SERVER_ID} roleId={ROLE_ID} />, { wrapper });
}

describe('Roles access', () => {
  it('hides "Add Inheritance Rule" without roles:write', async () => {
    mockRolesView();
    signInAs({ permissions: { servers: 'read', roles: 'read', stats: 'read' } });
    renderRolesView();
    // Wait for the stats to load (the button only appears with them) before asserting.
    await screen.findByText('Developer');
    expect(screen.queryByRole('button', { name: /add inheritance rule/i })).not.toBeInTheDocument();
  });

  it('shows it with roles:write', async () => {
    mockRolesView();
    signInAs({ permissions: { servers: 'read', roles: 'write', stats: 'read' } });
    renderRolesView();
    expect(
      await screen.findByRole('button', { name: /add inheritance rule/i })
    ).toBeInTheDocument();
  });

  it('locks every permission checkbox for a read-only member', async () => {
    mockRoleDetail();
    signInAs({ permissions: { servers: 'read', roles: 'read', stats: 'read' } });
    renderRoleDetail();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes.every((box) => box.hasAttribute('disabled'))).toBe(true);
  });

  it('lets a writer add permissions but not remove the ones already granted', async () => {
    mockRoleDetail();
    signInAs({ permissions: { servers: 'read', roles: 'write', stats: 'read' } });
    renderRoleDetail();
    const boxes = await screen.findAllByRole('checkbox');
    // Radix checkboxes are buttons: the state lives in aria-checked, not input.checked.
    const granted = boxes.filter((box) => box.getAttribute('aria-checked') === 'true');
    const free = boxes.filter((box) => box.getAttribute('aria-checked') !== 'true');
    expect(granted.length).toBeGreaterThan(0);
    expect(granted.every((box) => box.hasAttribute('disabled'))).toBe(true);
    expect(free.every((box) => !box.hasAttribute('disabled'))).toBe(true);
  });

  it('lets a manager toggle everything', async () => {
    mockRoleDetail();
    signInAs({ permissions: { servers: 'read', roles: 'manage', stats: 'read' } });
    renderRoleDetail();
    const boxes = await screen.findAllByRole('checkbox');
    expect(boxes.every((box) => !box.hasAttribute('disabled'))).toBe(true);
  });
});
