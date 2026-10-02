import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { ToastContainer } from '@/shared/components/common/ToastContainer';
import { useToastStore } from '@/shared/stores/toast';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('renders no toast content when the store is empty, but keeps the live region mounted', () => {
    render(<ToastContainer />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders a toast for each entry in the store', () => {
    useToastStore.setState({
      toasts: [{ id: 't1', message: 'Your session has expired.', variant: 'warning' }],
    });

    render(<ToastContainer />);

    expect(screen.getByText('Your session has expired.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('uses the assertive alert role for error/warning and the polite status role otherwise', () => {
    useToastStore.setState({
      toasts: [
        { id: 't1', message: 'Something failed.', variant: 'error' },
        { id: 't2', message: 'All good.', variant: 'success' },
      ],
    });

    render(<ToastContainer />);

    expect(screen.getByText('Something failed.').closest('[role]')).toHaveAttribute(
      'role',
      'alert'
    );
    expect(screen.getByText('All good.').closest('[role]')).toHaveAttribute('role', 'status');
  });
});
