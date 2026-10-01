import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Breadcrumb } from '@/shared/components/layout/breadcrumb';

describe('Breadcrumb', () => {
  it('renders nothing for an empty item list', () => {
    const { container } = render(<Breadcrumb items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a single current item as a non-navigable page marker', () => {
    render(<Breadcrumb items={[{ label: 'Dashboard' }]} />);

    const current = screen.getByText('Dashboard');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('aria-disabled', 'true');
    expect(current.tagName).toBe('SPAN');
  });

  it('renders earlier items as links and the last item as the current page', () => {
    render(
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Servers' }]} />
    );

    const link = screen.getByRole('link', { name: 'Dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');

    const current = screen.getByText('Servers');
    expect(current).toHaveAttribute('aria-current', 'page');
  });
});
