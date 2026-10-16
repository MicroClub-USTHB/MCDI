import { toast } from '@/shared/components/ui/mc-sonner';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

/** Shows a toast through the mcoli-ui Sonner toaster mounted in `Providers`. */
export function showToast(message: string, variant: ToastVariant = 'info'): string | number {
  return toast[variant](message);
}
