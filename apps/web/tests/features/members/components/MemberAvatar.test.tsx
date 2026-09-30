import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MemberAvatar } from '@/features/members/components/MemberAvatar';

describe('MemberAvatar', () => {
  it('renders animated Discord avatars and falls back to initials on load error', async () => {
    render(
      <MemberAvatar
        displayName="Clubber Lang"
        avatarUrl="https://cdn.discordapp.com/avatars/123/a_animatedhash.gif?size=64"
        avatarInitials="CL"
      />
    );

    const image = screen.getByRole('img', { name: 'Clubber Lang avatar' });
    expect(image).toHaveAttribute(
      'src',
      'https://cdn.discordapp.com/avatars/123/a_animatedhash.gif?size=64'
    );

    fireEvent.error(image);

    await waitFor(() => {
      expect(screen.getByText('CL')).toBeInTheDocument();
    });
  });

  it('renders initials when no avatar URL is available', () => {
    render(<MemberAvatar displayName="Clubber Lang" avatarUrl={null} avatarInitials="CL" />);

    expect(screen.getByText('CL')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
