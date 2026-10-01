import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ImpactPreview } from '@/features/roles/components';

describe('ImpactPreview', () => {
  it('shows "will gain" message for add action', () => {
    render(<ImpactPreview affectedMembers={15} roleHolders={30} action="add" />);

    expect(screen.getByText('15 members will gain these permissions')).toBeInTheDocument();
  });

  it('shows "will lose" message for remove action', () => {
    render(<ImpactPreview affectedMembers={5} roleHolders={20} action="remove" />);

    expect(screen.getByText('5 members will lose these permissions')).toBeInTheDocument();
  });

  it('uses singular form for single member', () => {
    render(<ImpactPreview affectedMembers={1} roleHolders={10} action="add" />);

    expect(screen.getByText('1 member will gain these permissions')).toBeInTheDocument();
  });

  it('shows total role holders count', () => {
    render(<ImpactPreview affectedMembers={8} roleHolders={25} action="add" />);

    expect(screen.getByText('25 total role holders')).toBeInTheDocument();
  });
});
