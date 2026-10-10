import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import { CreateWebhookForm } from '@/features/inbound-webhooks/components/create-webhook-form';
import { WebhookReadersSection } from '@/features/inbound-webhooks/components/webhook-readers-section';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('@/features/inbound-webhooks/components/schema-editor', () => ({
  SchemaEditor: ({ value, onChange }: { value: string; onChange: (text: string) => void }) => (
    <textarea
      aria-label="Schema JSON"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const API = 'http://localhost:3000/api';
const EXECUTIVE = '700000000000000001';
const MEMBER = '700000000000000003';

const webhook = { id: 'wh_1', projectId: 'proj_1' } as InboundWebhookDto;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The role list of every server comes from `/admin/stats/roles`. */
function serve() {
  server.use(
    http.get(`${API}/admin/inbound-webhooks/wh_1/roles`, () =>
      HttpResponse.json([
        { roleId: EXECUTIVE, roleName: 'MC Executive', roleColor: 0, serverId: 'srv-main' },
      ])
    ),
    http.get(`${API}/admin/inbound-webhooks/settings`, () =>
      HttpResponse.json({
        defaultReaderRoleIds: [EXECUTIVE],
        defaultReaderRoles: [
          { id: EXECUTIVE, name: 'MC Executive', serverId: 'srv-main', serverName: 'Main' },
        ],
        source: 'settings',
        updatedAt: null,
        updatedBy: null,
      })
    ),
    http.get(`${API}/admin/projects/access/matrix`, () =>
      HttpResponse.json([{ projectId: 'proj_1', serverId: 'srv-events', serverName: 'Events' }])
    ),
    http.get(`${API}/admin/stats/roles`, () =>
      HttpResponse.json({
        serverId: 'srv-events',
        serverName: 'Events',
        scope: 'server',
        totalMembers: 10,
        roles: [{ roleId: MEMBER, roleName: 'Member', color: 0, memberCount: 9 }],
      })
    ),
    http.post(`${API}/admin/inbound-webhooks/schema/preview`, () =>
      HttpResponse.json({ ok: true, markdown: '# Docs', examplePayload: {} })
    )
  );
}

const NOTE = /listing roles needs access to statistics/i;

describe('Readers editor without statistics access', () => {
  beforeEach(serve);

  it('says why roles cannot be listed, instead of loading forever', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'write' } });
    render(<WebhookReadersSection webhook={webhook} />, { wrapper });

    expect(await screen.findByText(NOTE)).toBeInTheDocument();
    expect(await screen.findByText('MC Executive')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByText('Loading roles…')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search roles')).not.toBeInTheDocument();
  });

  it('cannot be edited, even with inbound_webhooks:write', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'write' } });
    render(<WebhookReadersSection webhook={webhook} />, { wrapper });

    await screen.findByText(NOTE);
    expect(screen.queryByRole('button', { name: 'Save readers' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove MC Executive' })).toBeDisabled();
  });

  it('lists the roles and can be saved with statistics access', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'write', stats: 'read' } });
    render(<WebhookReadersSection webhook={webhook} />, { wrapper });

    expect(await screen.findByLabelText('Member')).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save readers' })).toBeInTheDocument();
  });

  it('still lists the roles, read-only, for a reader who has statistics access', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'read', stats: 'read' } });
    render(<WebhookReadersSection webhook={webhook} />, { wrapper });

    expect(await screen.findByLabelText('Member')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save readers' })).not.toBeInTheDocument();
  });
});

describe('Create form without statistics access', () => {
  beforeEach(serve);

  it('keeps the default readers and says why other roles cannot be picked', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'write' } });
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });

    expect(await screen.findByText(NOTE)).toBeInTheDocument();
    expect(
      await within(await screen.findByRole('list', { name: 'Selected roles' })).findByText(
        'MC Executive'
      )
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(screen.queryByText('Loading roles…')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Search roles')).not.toBeInTheDocument();
  });

  it('offers the full role list with statistics access', async () => {
    signInAs({ permissions: { projects: 'read', inbound_webhooks: 'write', stats: 'read' } });
    render(<CreateWebhookForm projectId="proj_1" />, { wrapper });

    expect(await screen.findByLabelText('Member')).toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});
