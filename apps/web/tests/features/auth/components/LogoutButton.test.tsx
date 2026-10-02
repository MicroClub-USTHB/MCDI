import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/features/auth/api/service', () => ({
  logoutAdmin: vi.fn(),
}));

import { LogoutButton } from '@/features/auth/components/LogoutButton';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('LogoutButton', () => {
  it('renders the label by default', () => {
    render(<LogoutButton />, { wrapper });
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('renders icon-only with an accessible label when iconOnly is set', () => {
    render(<LogoutButton iconOnly />, { wrapper });
    const button = screen.getByRole('button', { name: 'Log out' });
    expect(button).toHaveAttribute('aria-label', 'Log out');
    expect(button).not.toHaveTextContent('Log out');
  });
});
