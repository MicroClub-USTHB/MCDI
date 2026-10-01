import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Input, SearchInput } from '@/shared/components/ui/input';

describe('Input', () => {
  it('renders an input accepting a placeholder', () => {
    render(<Input placeholder="Email" aria-label="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  });
});

describe('SearchInput', () => {
  it('renders a search input with the given placeholder', () => {
    render(<SearchInput placeholder="Search..." aria-label="Search" />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Search...');
  });
});
