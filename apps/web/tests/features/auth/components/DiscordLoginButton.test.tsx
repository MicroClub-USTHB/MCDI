import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { DiscordLoginButton } from '@/features/auth/components/DiscordLoginButton';

const OAUTH_URL = 'http://localhost:3000/api/auth/admin/discord';
const REDIRECT_KEY = 'mcdi.auth.post-login-redirect';

describe('DiscordLoginButton', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('links to the backend Discord OAuth endpoint', () => {
    render(<DiscordLoginButton redirectPath="/dashboard/servers" />);

    const link = screen.getByRole('link', { name: /login with discord/i });
    // No `redirect` param: the backend ignores one, so the destination is
    // stashed client-side on activation instead.
    expect(link).toHaveAttribute('href', OAUTH_URL);
  });

  it('stashes the redirect path on activation so it survives the OAuth bounce', async () => {
    render(<DiscordLoginButton redirectPath="/dashboard/servers" />);

    await userEvent.click(screen.getByRole('link', { name: /login with discord/i }));

    expect(window.sessionStorage.getItem(REDIRECT_KEY)).toBe('/dashboard/servers');
  });

  it('stashes the default dashboard path when no redirect is given', async () => {
    render(<DiscordLoginButton />);

    await userEvent.click(screen.getByRole('link', { name: /login with discord/i }));

    expect(window.sessionStorage.getItem(REDIRECT_KEY)).toBe('/dashboard');
  });

  it('shows the connecting state and stashes nothing when isLoading is true', async () => {
    render(<DiscordLoginButton isLoading />);

    expect(screen.getByText(/connecting to discord/i)).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(link);
    expect(window.sessionStorage.getItem(REDIRECT_KEY)).toBeNull();
  });
});
