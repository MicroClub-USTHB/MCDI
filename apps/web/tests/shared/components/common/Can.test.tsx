import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signInAs } from '../../../helpers/auth';
import { Can } from '@/shared/components/common/Can';

describe('<Can>', () => {
  it('renders its children when the member reaches the level', () => {
    signInAs({ permissions: { servers: 'manage' } });
    render(
      <Can resource="servers" level="write">
        <button type="button">Add server</button>
      </Can>
    );
    expect(screen.getByRole('button', { name: 'Add server' })).toBeInTheDocument();
  });

  it('renders nothing, or the fallback, below the level', () => {
    signInAs({ permissions: { servers: 'read' } });
    const { rerender } = render(
      <Can resource="servers" level="write">
        <button type="button">Add server</button>
      </Can>
    );
    expect(screen.queryByRole('button', { name: 'Add server' })).not.toBeInTheDocument();

    rerender(
      <Can resource="servers" level="write" fallback={<span>Read only</span>}>
        <button type="button">Add server</button>
      </Can>
    );
    expect(screen.getByText('Read only')).toBeInTheDocument();
  });
});
