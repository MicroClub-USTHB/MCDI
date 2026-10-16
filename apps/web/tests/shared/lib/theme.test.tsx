import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from '@/shared/components/common/ThemeToggle';
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from '@/shared/lib/theme';

function prefersDark(dark: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  document.documentElement.classList.remove('dark');
  prefersDark(false);
});

describe('theme', () => {
  it('follows the system when nothing is stored', () => {
    prefersDark(true);
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /theme: system/i })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('cycles system, light, dark and stores the choice', async () => {
    prefersDark(true);
    render(<ThemeToggle />);
    const toggle = () => screen.getByRole('button', { name: /^theme:/i });

    await userEvent.click(toggle());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement).not.toHaveClass('dark');
    expect(toggle()).toHaveAccessibleName(/theme: light/i);

    await userEvent.click(toggle());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');

    await userEvent.click(toggle());
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(toggle()).toHaveAccessibleName(/theme: system/i);
  });

  it('applies a stored choice before React renders, from the inline script', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement).toHaveClass('dark');

    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    prefersDark(true);
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
