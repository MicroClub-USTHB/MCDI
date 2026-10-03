import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import DashboardError from '@/app/dashboard/error';

describe('dashboard error boundary', () => {
  it('shows a recoverable error instead of taking the whole app down', async () => {
    const retry = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<DashboardError error={new Error('Element type is invalid')} unstable_retry={retry} />);

    expect(
      screen.getByRole('heading', { name: 'This page ran into a problem' })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('reports the error to the console for debugging', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('boom');

    render(<DashboardError error={error} unstable_retry={vi.fn()} />);

    expect(consoleError).toHaveBeenCalledWith(error);
  });
});
