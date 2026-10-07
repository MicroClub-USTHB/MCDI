import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OverridesList } from '@/features/access/components/OverridesList';
import type { OverrideMemberDto } from '@/features/access';

const member = (overrides: Partial<OverrideMemberDto> = {}): OverrideMemberDto => ({
  memberId: 'm1',
  username: 'ada',
  displayName: 'Ada',
  avatar: null,
  root: false,
  overrides: { messages: 'none', projects: 'manage' },
  ...overrides,
});

describe('OverridesList', () => {
  it('summarizes each member and links to their Access page', () => {
    render(<OverridesList members={[member()]} />);

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Messages: none')).toBeInTheDocument();
    expect(screen.getByText('Projects: manage')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ada/i })).toHaveAttribute(
      'href',
      '/dashboard/members/m1/access'
    );
  });

  it('marks overrides that are inactive because the member is root now', () => {
    render(<OverridesList members={[member({ root: true })]} />);
    expect(screen.getByText(/inactive while root/i)).toBeInTheDocument();
  });

  it('says so when nobody has an override', () => {
    render(<OverridesList members={[]} />);
    expect(screen.getByText(/no member has an override/i)).toBeInTheDocument();
  });
});
