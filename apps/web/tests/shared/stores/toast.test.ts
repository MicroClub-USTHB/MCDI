import { describe, it, expect, vi } from 'vitest';
import type * as ToastModule from '@/shared/stores/toast';

const { success, error, warning, info } = vi.hoisted(() => ({
  success: vi.fn(() => 1),
  error: vi.fn(() => 2),
  warning: vi.fn(() => 3),
  info: vi.fn(() => 4),
}));

vi.mock('@/shared/components/ui/mc-sonner', () => ({ toast: { success, error, warning, info } }));

describe('showToast', () => {
  it('shows the message on the Sonner toaster with the matching variant', async () => {
    const { showToast } = await vi.importActual<typeof ToastModule>('@/shared/stores/toast');

    expect(showToast('Saved', 'success')).toBe(1);
    expect(success).toHaveBeenCalledWith('Saved');
    showToast('Session expired', 'warning');
    expect(warning).toHaveBeenCalledWith('Session expired');
    showToast('Failed', 'error');
    expect(error).toHaveBeenCalledWith('Failed');
  });

  it('defaults to the info variant', async () => {
    const { showToast } = await vi.importActual<typeof ToastModule>('@/shared/stores/toast');

    showToast('Heads up');
    expect(info).toHaveBeenCalledWith('Heads up');
  });
});
