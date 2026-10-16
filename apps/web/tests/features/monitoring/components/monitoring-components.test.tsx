import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuditLogFilters } from '@/features/monitoring/components/AuditLogFilters';
import { HealthIndicator } from '@/features/monitoring/components/HealthIndicator';
import type { CrossServerListItemDto } from '@/features/members/types';
import type { AuditActionType } from '@/features/monitoring/types';
import type { AuditLogFilters as AuditLogFilterState } from '@/features/monitoring/types';

const ACTIONS: Array<{ label: string; value: AuditActionType }> = [
  { label: 'Auth', value: 'auth' },
  { label: 'Project', value: 'project' },
  { label: 'Server', value: 'server' },
  { label: 'Role', value: 'role' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'Member', value: 'member' },
  { label: 'Sync', value: 'sync' },
  { label: 'Permission', value: 'permission' },
];

const ACTORS: CrossServerListItemDto[] = [
  {
    memberId: 'admin-1',
    username: 'admin1',
    globalName: 'Admin One',
    avatar: null,
    isClubMember: true,
    serverCount: 1,
    servers: [],
  },
];

function FiltersHarness({ onChange }: { onChange?: (filters: AuditLogFilterState) => void }) {
  const [filters, setFilters] = useState<AuditLogFilterState>({});

  const handleChange = (next: AuditLogFilterState) => {
    setFilters(next);
    onChange?.(next);
  };

  return <AuditLogFilters filters={filters} onChange={handleChange} actors={ACTORS} />;
}

describe('monitoring components', () => {
  it.each([
    ['connected', 'success', 'Online'],
    ['degraded', 'warning', 'Degraded'],
    ['disconnected', 'error', 'Down'],
  ] as const)('renders %s health with %s badge and %s label', (status, variant, label) => {
    render(<HealthIndicator service="Redis" status={status} details="97.5% hit rate · 1.25M" />);

    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText(label).closest(`[data-tone="${variant}"]`)).toBeInTheDocument();
    expect(screen.getByText('97.5% hit rate · 1.25M')).toBeInTheDocument();
  });

  it('updates audit date, severity, and actor filters', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FiltersHarness onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Date from'), { target: { value: '2026-04-01' } });
    fireEvent.change(screen.getByLabelText('Date to'), { target: { value: '2026-04-30' } });
    await user.click(screen.getByRole('combobox', { name: 'Actor' }));
    await user.click(await screen.findByRole('option', { name: 'Admin One' }));
    await user.click(screen.getByRole('combobox', { name: 'Severity' }));
    await user.click(await screen.findByRole('option', { name: 'Warning' }));

    expect(screen.getByLabelText('Date from')).toHaveValue('2026-04-01');
    expect(screen.getByLabelText('Date to')).toHaveValue('2026-04-30');
    expect(screen.getByRole('combobox', { name: 'Actor' })).toHaveTextContent('Admin One');
    expect(screen.getByRole('combobox', { name: 'Severity' })).toHaveTextContent('Warning');
    expect(onChange).toHaveBeenLastCalledWith({
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
      actorId: 'admin-1',
      severity: 'warning',
    });
  });

  it.each(ACTIONS)('sets the %s action filter', async ({ label, value }) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FiltersHarness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: label }));

    expect(screen.getByRole('radio', { name: label })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith({ actionType: value });
  });
});
