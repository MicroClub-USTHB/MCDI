import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { RoleOption } from '@/features/inbound-webhooks/api/mappers';
import { RolePicker } from '@/features/inbound-webhooks/components/role-picker';

const OPTIONS: RoleOption[] = [
  { id: '1', name: 'MC Executive', serverName: 'Main', isDefault: true },
  { id: '2', name: 'Dev Leads', serverName: 'Main', isDefault: false },
  { id: '3', name: 'Member', serverName: 'Events', isDefault: false },
];

function Harness({ initial }: { initial: string[] }) {
  const [selected, setSelected] = useState(initial);
  return <RolePicker options={OPTIONS} selected={selected} onChange={setSelected} />;
}

describe('RolePicker', () => {
  it('shows the selected roles as chips and marks the default one', () => {
    render(<Harness initial={['1', '3']} />);

    const chips = screen.getByRole('list', { name: 'Selected roles' });
    expect(chips).toHaveTextContent('MC Executive');
    expect(chips).toHaveTextContent('default');
    expect(chips).toHaveTextContent('Member');
    expect(chips).not.toHaveTextContent('Dev Leads');
  });

  it('lets the default role be removed like any other', async () => {
    render(<Harness initial={['1', '3']} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove MC Executive' }));

    expect(screen.getByRole('list', { name: 'Selected roles' })).not.toHaveTextContent(
      'MC Executive'
    );
    expect(screen.getByRole('checkbox', { name: 'MC Executive' })).not.toBeChecked();
  });

  it('adds a role from the list', async () => {
    render(<Harness initial={['1']} />);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Dev Leads' }));

    expect(screen.getByRole('list', { name: 'Selected roles' })).toHaveTextContent('Dev Leads');
  });

  it('narrows the list by role or server name', async () => {
    render(<Harness initial={[]} />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search roles' }), 'events');

    expect(screen.getByRole('checkbox', { name: 'Member' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Dev Leads' })).toBeNull();
  });

  it('warns when nothing is selected', () => {
    render(<Harness initial={[]} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/at least one role/i);
  });

  it('positions the scrolling list, so the checkboxes hidden inputs stay inside it', () => {
    render(<Harness initial={[]} />);

    const list = screen.getByRole('checkbox', { name: 'Member' }).closest('ul');

    expect(list).toHaveClass('relative', 'overflow-y-auto');
  });
});
