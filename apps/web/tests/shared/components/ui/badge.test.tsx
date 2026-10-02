import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Badge } from '@/shared/components/ui/badge';

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>MAIN</Badge>);
    expect(screen.getByText('MAIN')).toBeInTheDocument();
  });

  it('defaults to the brand variant', () => {
    render(<Badge>MAIN</Badge>);
    expect(screen.getByText('MAIN')).toHaveAttribute('data-variant', 'brand');
  });

  it.each([
    ['brand-light', 'partner'],
    ['success', 'online'],
    ['error', 'offline'],
    ['warning', 'syncing'],
  ] as const)('applies the %s variant', (variant, label) => {
    render(<Badge variant={variant}>{label}</Badge>);
    expect(screen.getByText(label)).toHaveAttribute('data-variant', variant);
  });
});
