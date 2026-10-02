import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CacheSettings } from '@/features/settings/components/CacheSettings';
import { DiscordConfigForm } from '@/features/settings/components/DiscordConfigForm';
import { ProfileSettings } from '@/features/settings/components/ProfileSettings';
import type {
  AdminProfileDto,
  CacheSettingsGroup,
  DiscordSettings,
} from '@/features/settings/types';

const DISCORD_CONFIG: DiscordSettings = {
  clientId: { value: '123456789012345678', editable: false },
  guildId: { value: '987654321098765432', editable: false },
  callbackUrl: { value: 'https://mcdi.example.com/api/auth/discord/callback', editable: false },
  token: { isSet: true, editable: false },
  clientSecret: { isSet: false, editable: false },
};

const CACHE_SETTINGS: CacheSettingsGroup = {
  permissionTtlMs: { value: 300_000, editable: true },
  statsTtlMs: { value: 300_000, editable: true },
  projectAuthTtlMs: { value: 30_000, editable: false },
  projectAccessTtlMs: { value: 30_000, editable: false },
};

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

describe('DiscordConfigForm', () => {
  it('shows read-only config values and secret presence, never the secret itself', () => {
    render(<DiscordConfigForm config={DISCORD_CONFIG} />);

    expect(screen.getByDisplayValue('123456789012345678')).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /token/i })).not.toBeInTheDocument();
  });
});

describe('CacheSettings', () => {
  it('shows an inline error and does not call onSave for an out-of-range TTL', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CacheSettings settings={CACHE_SETTINGS} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Permission cache TTL (ms)'), {
      target: { value: '100' },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Must be at least 1,000 ms')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onSave with the cache payload for valid input', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CacheSettings settings={CACHE_SETTINGS} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Stats cache TTL (ms)'), {
      target: { value: '600000' },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      cache: { permissionTtlMs: 300_000, statsTtlMs: 600_000 },
    });
  });
});

describe('ProfileSettings', () => {
  it('edits and saves a preferred name', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ProfileSettings profile={PROFILE} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit name' }));
    fireEvent.change(screen.getByLabelText('Preferred name'), {
      target: { value: 'J. Doe' },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({ preferredName: 'J. Doe' });
  });

  it('clears the preferred name when saved blank', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ProfileSettings profile={{ ...PROFILE, preferredName: 'J. Doe' }} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit name' }));
    fireEvent.change(screen.getByLabelText('Preferred name'), { target: { value: '  ' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({ preferredName: null });
  });

  it('discards edits on cancel', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ProfileSettings profile={PROFILE} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Edit name' }));
    fireEvent.change(screen.getByLabelText('Preferred name'), { target: { value: 'Nope' } });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Edit name' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Preferred name')).not.toBeInTheDocument();
  });
});
