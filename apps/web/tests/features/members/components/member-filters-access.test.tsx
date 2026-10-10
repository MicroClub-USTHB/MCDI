import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { signInAs } from '../../../helpers/auth';
import { MemberFilters } from '@/features/members/components/MemberFilters';
import type { MemberFilters as MemberFiltersState } from '@/features/members/types';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const filters: MemberFiltersState = {
  filter: 'all',
  serverIds: [],
  roleIds: [],
  page: 1,
  pageSize: 20,
};

function renderFilters() {
  return render(
    <MemberFilters filters={filters} onFilterChange={vi.fn()} onClearFilters={vi.fn()} />,
    { wrapper }
  );
}

describe('MemberFilters access', () => {
  it('hides the server filter without servers:read and the role filter without stats:read', () => {
    signInAs({ permissions: { members: 'read' } });
    renderFilters();

    expect(screen.queryAllByText('Servers')).toHaveLength(0);
    expect(screen.queryAllByText('Roles')).toHaveLength(0);
    expect(screen.getByText('Club')).toBeInTheDocument();
  });

  it('shows the server filter with servers:read, and the role filter only with stats:read too', () => {
    signInAs({ permissions: { members: 'read', servers: 'read' } });
    const { unmount } = renderFilters();
    expect(screen.getAllByText('Servers').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Roles')).toHaveLength(0);
    unmount();

    signInAs({ permissions: { members: 'read', servers: 'read', stats: 'read' } });
    renderFilters();
    expect(screen.getAllByText('Roles').length).toBeGreaterThan(0);
  });
});
