import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from '@/features/members/components/pagination';

describe('Pagination', () => {
  it('navigates pages and changes page size', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <Pagination
        page={2}
        pageSize={50}
        total={123}
        totalPages={7}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    expect(screen.getByText('Showing 51-100 of 123')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);

    await user.selectOptions(screen.getByRole('combobox'), '100');
    expect(onPageSizeChange).toHaveBeenCalledWith(100);
  });
});
