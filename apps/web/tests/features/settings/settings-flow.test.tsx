import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '../../setup';
import SettingsPage from '@/app/dashboard/settings/page';
import type { AdminProfileDto, SettingsDto } from '@/features/settings/types';

const BASE_URL = 'http://localhost:3000/api';

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
    meta: { updatedAt: null, updatedBy: null },
    ...overrides,
  };
}

const PROFILE: AdminProfileDto = {
  id: '111111111111111111',
  username: 'johndoe',
  globalName: 'John Doe',
  displayName: 'John',
  preferredName: null,
  avatar: null,
  email: 'johndoe@example.com',
  isSystemAdmin: true,
};

describe('settings flow', () => {
  it('loads settings and profile, saves a cache TTL change, and resets to defaults', async () => {
    let settings = buildSettings();
    let patchBody: unknown;
    let resetCalled = false;

    server.use(
      http.get(`${BASE_URL}/admin/settings`, () => HttpResponse.json(settings)),
      http.get(`${BASE_URL}/admin/profile`, () => HttpResponse.json(PROFILE)),
      http.patch(`${BASE_URL}/admin/settings`, async ({ request }) => {
        patchBody = await request.json();
        settings = buildSettings({
          cache: {
            ...settings.cache,
            statsTtlMs: { value: 600_000, editable: true },
          },
        });
        return HttpResponse.json(settings);
      }),
      http.post(`${BASE_URL}/admin/settings/reset`, () => {
        resetCalled = true;
        settings = buildSettings();
        return HttpResponse.json(settings);
      })
    );

    const user = userEvent.setup();
    render(<SettingsPage />, { wrapper });

    expect(await screen.findByText('John')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === '@johndoe')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('123456789012345678')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Stats cache TTL (ms)'));
    await user.type(screen.getByLabelText('Stats cache TTL (ms)'), '600000');
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]!);

    await waitFor(() =>
      expect(patchBody).toEqual({ cache: { permissionTtlMs: 300_000, statsTtlMs: 600_000 } })
    );

    await user.click(screen.getByRole('button', { name: /reset to defaults/i }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(resetCalled).toBe(true));
  });
});
