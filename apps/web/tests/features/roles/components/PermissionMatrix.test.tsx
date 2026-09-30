import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { PermissionMatrix } from '@/features/roles/components';
import { PERMISSION_CATALOG } from '@/features/roles/types';

function setup(overrides: Partial<Parameters<typeof PermissionMatrix>[0]> = {}) {
  const onToggle = vi.fn();
  render(
    <PermissionMatrix
      assignedIds={new Set()}
      savingIds={new Set()}
      locked={false}
      onToggle={onToggle}
      {...overrides}
    />
  );
  return { onToggle };
}

describe('PermissionMatrix (role permission list)', () => {
  it('renders every catalog permission as a row', () => {
    setup();
    expect(screen.getByText('SEND_MESSAGES')).toBeInTheDocument();
    expect(screen.getByText('MANAGE_ROLES')).toBeInTheDocument();
    expect(screen.getByText('KICK_MEMBERS')).toBeInTheDocument();
    expect(
      screen.getByText(`${PERMISSION_CATALOG.length}/${PERMISSION_CATALOG.length}`)
    ).toBeInTheDocument();
  });

  it('filters the list by key and updates the count', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText('Filter permissions'), 'THREAD');

    expect(screen.getByText('MANAGE_THREADS')).toBeInTheDocument();
    expect(screen.queryByText('KICK_MEMBERS')).not.toBeInTheDocument();
    expect(
      screen.queryByText(`${PERMISSION_CATALOG.length}/${PERMISSION_CATALOG.length}`)
    ).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByLabelText('Filter permissions'), 'zzzznope');
    expect(screen.getByText(/No permissions match/)).toBeInTheDocument();
  });

  it('reflects the assigned permission set', () => {
    setup({ assignedIds: new Set([12]) }); // SEND_MESSAGES
    expect(screen.getByRole('checkbox', { name: 'Remove SEND_MESSAGES' })).toHaveAttribute(
      'data-state',
      'checked'
    );
    expect(screen.getByRole('checkbox', { name: 'Add KICK_MEMBERS' })).toHaveAttribute(
      'data-state',
      'unchecked'
    );
  });

  it('calls onToggle with the permission id and next checked state', () => {
    const { onToggle } = setup({ assignedIds: new Set([12]) });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remove SEND_MESSAGES' }));
    expect(onToggle).toHaveBeenCalledWith(12, false);
  });

  it('locks every checkbox when locked', () => {
    setup({ locked: true });
    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).toBeDisabled());
  });
});
