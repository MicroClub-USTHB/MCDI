import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuditLogFilters } from '@/features/monitoring/components/AuditLogFilters';

describe('AuditLogFilters', () => {
  it('offers the access action type', () => {
    render(<AuditLogFilters filters={{}} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Access' })).toBeInTheDocument();
  });
});
