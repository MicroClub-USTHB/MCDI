import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ApiKeyDisplay } from '@/features/projects/components';

describe('ApiKeyDisplay', () => {
  it('shows the key prefix in a masked field', () => {
    render(
      <ApiKeyDisplay prefix="mcdi_abc123" isActive onReveal={vi.fn()} onRegenerate={vi.fn()} />
    );

    expect(screen.getByDisplayValue('mcdi_abc123')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reveal/i })).toBeInTheDocument();
  });

  it('emits reveal and regenerate callbacks', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onReveal = vi.fn();
    const onRegenerate = vi.fn();

    render(
      <ApiKeyDisplay
        prefix="mcdi_abc123"
        isActive
        onReveal={onReveal}
        onRegenerate={onRegenerate}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /reveal/i }));
    await userEvent.click(screen.getByRole('button', { name: /regenerate/i }));

    expect(onReveal).toHaveBeenCalledOnce();
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it('disables regeneration and warns when the project is inactive', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const onRegenerate = vi.fn();

    render(
      <ApiKeyDisplay
        prefix="mcdi_abc123"
        isActive={false}
        onReveal={vi.fn()}
        onRegenerate={onRegenerate}
      />
    );

    const regenerate = screen.getByRole('button', { name: /regenerate/i });
    await userEvent.click(regenerate);

    expect(regenerate).toBeDisabled();
    expect(onRegenerate).not.toHaveBeenCalled();
    expect(screen.getByText(/reactivate the project/i)).toBeInTheDocument();
  });
});
