import type { ToastVariant } from '@/shared/stores/toast';

export interface ShownToast {
  message: string;
  variant: ToastVariant;
}

/**
 * Every toast a test triggered, in order. `tests/setup.ts` routes `showToast` here instead of the
 * Sonner toaster, so a test asserts on what the user was told without rendering the toaster.
 */
export const shownToasts: ShownToast[] = [];

export function recordToast(message: string, variant: ToastVariant = 'info'): number {
  shownToasts.push({ message, variant });
  return shownToasts.length;
}

export function toastMessages(): string[] {
  return shownToasts.map((toast) => toast.message);
}
