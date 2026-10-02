import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '@/shared/stores/toast';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('adds a toast with the given message and variant', () => {
    const id = useToastStore.getState().show('Session expired', 'warning');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ id, message: 'Session expired', variant: 'warning' });
  });

  it('defaults to the info variant', () => {
    useToastStore.getState().show('Heads up');

    expect(useToastStore.getState().toasts[0]?.variant).toBe('info');
  });

  it('dismisses a toast by id', () => {
    const id = useToastStore.getState().show('Bye');
    useToastStore.getState().dismiss(id);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
