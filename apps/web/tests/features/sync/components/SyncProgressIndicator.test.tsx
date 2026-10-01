import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SyncProgressIndicator } from '@/features/sync/components/SyncProgressIndicator';

describe('SyncProgressIndicator', () => {
  it('renders nothing while idle', () => {
    const { container } = render(<SyncProgressIndicator inProgress={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an indeterminate status region while a sync is running', () => {
    render(<SyncProgressIndicator inProgress />);

    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Sync in progress');
    expect(region.querySelector('.animate-sync-indeterminate')).not.toBeNull();
  });

  it('accepts a custom label', () => {
    render(<SyncProgressIndicator inProgress label="Resyncing roles" />);
    expect(screen.getByRole('status')).toHaveTextContent('Resyncing roles');
  });
});
