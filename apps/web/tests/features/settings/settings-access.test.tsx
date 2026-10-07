import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../setup';
import { signInAs } from '../../helpers/auth';
import SettingsPage from '@/app/dashboard/settings/page';
import type { AdminProfileDto, SettingsDto } from '@/features/settings/types';

const API = 'http://localhost:3000/api';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function buildSettings(overrides: Partial<SettingsDto> = {}): SettingsDto {
  return {
    discord: {
      clientId: { value: '123456789012345678', editable: false },
      guildId: { value: '987654321098765432', editable: false },
      callbackUrl: { value: 'https://mcdi.example.com/callback', editable: false },
      token: { isSet: true, editable: false },
      clientSecret: { isSet: true, editable: false },
    },
    cache: {
      permissionTtlMs: { value: 300_000, editable: true },
      statsTtlMs: { value: 300_000, editable: true },
      projectAuthTtlMs: { value: 30_000, editable: false },
      projectAccessTtlMs: { value: 30_000, editable: false },
    },
    rateLimit: {
      globalTtlMs: { value: 60_000, editable: false },
      globalLimit: { value: 120, editable: false },
      maxWebhooksPerProject: { value: 10, editable: true },
    },
    preferences: {
      memberActivityThresholdDays: { value: 30, editable: true },
    },
    security: {
      webhookEncryptionKey: { isSet: true, editable: false },
      sessionTtlSec: { value: 2_592_000, editable: false },
      ssoTtlSec: { value: 2_592_000, editable: false },
    },
    meta: { updatedAt: '2026-08-01T10:00:00.000Z', updatedBy: null },
    ...overrides,
  };
}

const profileDto: AdminProfileDto = {
  id: '111111111111111111',
  username: 'johndoe',
  globalName: 'John Doe',
  displayName: 'John',
  preferredName: null,
  avatar: null,
  email: 'johndoe@example.com',
  isSystemAdmin: true,
};

const settingsDto = buildSettings();

function mockBoth() {
  server.use(
    http.get(`${API}/admin/settings`, () => HttpResponse.json(settingsDto)),
    http.get(`${API}/admin/profile`, () => HttpResponse.json(profileDto))
  );
}

function renderSettings() {
  return render(<SettingsPage />, { wrapper });
}

describe('Settings page access', () => {
  it('shows only the profile to a member with no settings access, and never asks for the settings', async () => {
    let settingsRequested = false;
    server.use(
      http.get(`${API}/admin/profile`, () => HttpResponse.json(profileDto)),
      http.get(`${API}/admin/settings`, () => {
        settingsRequested = true;
        return HttpResponse.json(settingsDto);
      })
    );
    signInAs({ permissions: {} });
    renderSettings();

    expect(await screen.findByText(/display name/i)).toBeInTheDocument();
    expect(screen.queryByText('Cache')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/last changed/i)).not.toBeInTheDocument();
    expect(screen.getByText('Manage your admin profile.')).toBeInTheDocument();
    expect(settingsRequested).toBe(false);
  });

  it('shows read-only forms to a reader, with no Save and no Reset', async () => {
    mockBoth();
    signInAs({ permissions: { settings: 'read' } });
    renderSettings();

    expect(await screen.findByText('Cache')).toBeInTheDocument();
    expect(screen.getAllByText('Read only').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /^save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).not.toBeInTheDocument();
    expect(screen.getByText(/last changed/i)).toBeInTheDocument();
  });

  it('lets a writer save the forms but not reset', async () => {
    mockBoth();
    signInAs({ permissions: { settings: 'write' } });
    renderSettings();

    await screen.findByText('Cache');
    expect(screen.getAllByRole('button', { name: /save/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /reset to defaults/i })).not.toBeInTheDocument();
  });

  it('lets a manager reset', async () => {
    mockBoth();
    signInAs({ permissions: { settings: 'manage' } });
    renderSettings();
    expect(await screen.findByRole('button', { name: /reset to defaults/i })).toBeInTheDocument();
  });

  it('keeps the settings visible when the profile fails to load, and the reverse', async () => {
    server.use(
      http.get(`${API}/admin/profile`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      ),
      http.get(`${API}/admin/settings`, () => HttpResponse.json(settingsDto))
    );
    signInAs({ permissions: { settings: 'read' } });
    renderSettings();

    expect(await screen.findByText('Cache')).toBeInTheDocument();
    expect(await screen.findByText(/profile could not be loaded/i)).toBeInTheDocument();
  });
});
