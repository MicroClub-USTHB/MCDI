import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ServerAccessMatrix } from '@/features/projects/components';
import type { AccessMatrixEntry, AccessOperations } from '@/features/projects/types';
import type { ServerListItemDto } from '@/features/servers/types';

const servers: ServerListItemDto[] = [
  {
    id: 'srv_1',
    name: 'Main',
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
  {
    id: 'srv_2',
    name: 'Dead',
    icon: null,
    type: 'other',
    isMain: false,
    isActive: false,
    syncFrequencyHours: 24,
    defaultPermissionPolicy: 'deny_all',
    disabledReason: 'Disabled',
    syncedAt: null,
    lastSyncAt: null,
    botConnected: false,
  },
];

const grantedOps: AccessOperations = {
  READ: true,
  SEND_MESSAGES: true,
  MANAGE_WEBHOOKS: false,
};

const grantedEntry: AccessMatrixEntry = {
  projectId: 'proj_1',
  projectName: 'Website',
  serverId: 'srv_1',
  serverName: 'Main',
  operations: grantedOps,
  scopes: ['read_members'],
  updatedAt: '2026-08-15T09:30:00.000Z',
};

function accessMap(entry?: AccessMatrixEntry): Record<string, AccessMatrixEntry> {
  return entry ? { [entry.serverId]: entry } : {};
}

describe('ServerAccessMatrix', () => {
  it('shows "No access" and disabled operation controls for ungranted servers', () => {
    render(
      <ServerAccessMatrix
        projectId="proj_1"
        servers={servers}
        accessMap={accessMap()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getAllByText('No access').length).toBe(2);
    expect(screen.getByRole('checkbox', { name: 'Read on Main' })).toBeDisabled();
  });

  it('grants a server with default READ + all scopes when toggled on', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onChange = vi.fn();

    render(
      <ServerAccessMatrix
        projectId="proj_1"
        servers={servers}
        accessMap={accessMap()}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Grant access to Main' }));

    expect(onChange).toHaveBeenCalledWith('srv_1', {
      operations: { READ: true, SEND_MESSAGES: false, MANAGE_WEBHOOKS: false },
      scopes: ['read_members', 'check_permissions'],
    });
  });

  it('revokes access when a granted server is toggled off', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onChange = vi.fn();

    render(
      <ServerAccessMatrix
        projectId="proj_1"
        servers={servers}
        accessMap={accessMap(grantedEntry)}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Revoke access for Main' }));

    expect(onChange).toHaveBeenCalledWith('srv_1', { revoke: true });
  });

  it('emits a scope change alongside the current operations', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onChange = vi.fn();

    render(
      <ServerAccessMatrix
        projectId="proj_1"
        servers={servers}
        accessMap={accessMap(grantedEntry)}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'Check permissions on Main' }));

    expect(onChange).toHaveBeenCalledWith('srv_1', {
      operations: grantedOps,
      scopes: ['read_members', 'check_permissions'],
    });
  });

  it('toggles a single operation and keeps the scopes', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onChange = vi.fn();

    render(
      <ServerAccessMatrix
        projectId="proj_1"
        servers={servers}
        accessMap={accessMap(grantedEntry)}
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'Manage webhooks on Main' }));

    expect(onChange).toHaveBeenCalledWith('srv_1', {
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: true },
      scopes: ['read_members'],
    });
  });

  it('disables every control while a mutation is in flight', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onChange = vi.fn();

    render(
      <ServerAccessMatrix
        projectId="proj_1"
        servers={servers}
        accessMap={accessMap(grantedEntry)}
        isMutating
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Revoke access for Main' }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Revoke access for Main' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Read on Main' })).toBeDisabled();
  });

  it('disables the grant switch for inactive servers', () => {
    render(
      <ServerAccessMatrix
        projectId="proj_1"
        servers={servers}
        accessMap={accessMap()}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('switch', { name: 'Grant access to Dead' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Grant access to Main' })).toBeEnabled();
  });
});
