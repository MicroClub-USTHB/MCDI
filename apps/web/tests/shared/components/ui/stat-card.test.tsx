import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { StatCard, StatCardSkeleton, StatCardError } from '@/shared/components/ui/stat-card';

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Members" value="1,247" />);
    expect(screen.getByText('Members')).toBeInTheDocument();
    expect(screen.getByText('1,247')).toBeInTheDocument();
  });

  it('renders a trend line when provided', () => {
    render(<StatCard label="Members" value="1,247" trend={{ direction: 'up', label: '+12%' }} />);
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('renders a status line when provided', () => {
    render(<StatCard label="Servers" value="3" status={{ tone: 'success', label: 'All up' }} />);
    expect(screen.getByText('All up')).toBeInTheDocument();
  });
});

describe('StatCardSkeleton', () => {
  it('announces itself as busy for screen readers', () => {
    render(<StatCardSkeleton label="Members" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading Members…')).toBeInTheDocument();
  });

  it('reserves a third row when rows=3, to avoid shifting layout once real data arrives', () => {
    const { container: twoRow } = render(<StatCardSkeleton label="Servers" />);
    const { container: threeRow } = render(<StatCardSkeleton label="Members" rows={3} />);

    const countSkeletons = (c: HTMLElement) => c.querySelectorAll('[data-slot="skeleton"]').length;
    expect(countSkeletons(threeRow)).toBe(countSkeletons(twoRow) + 1);
  });
});

describe('StatCardError', () => {
  it('states the failure and calls onRetry when clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onRetry = vi.fn();
    render(<StatCardError label="Servers" onRetry={onRetry} />);

    expect(screen.getByText('Failed to load')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
