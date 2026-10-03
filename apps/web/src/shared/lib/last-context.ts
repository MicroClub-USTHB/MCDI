import { useSyncExternalStore } from 'react';

/** Which sidebar switcher a remembered selection belongs to. */
export type ContextKind = 'server' | 'project';

const STORAGE_KEY: Record<ContextKind, string> = {
  server: 'mcdi:last-server',
  project: 'mcdi:last-project',
};

const listeners = new Set<() => void>();

/** The server or project the admin last opened, if this browser remembers one. */
export function readLastContextId(kind: ContextKind): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY[kind]);
  } catch {
    return null;
  }
}

export function rememberContextId(kind: ContextKind, id: string): void {
  try {
    if (window.localStorage.getItem(STORAGE_KEY[kind]) === id) return;
    window.localStorage.setItem(STORAGE_KEY[kind], id);
  } catch {
    // Storage unavailable (private mode, blocked): the switcher falls back to the first entry.
  }
  listeners.forEach((listener) => listener());
}

/** Read through `useSyncExternalStore` so the server render (no storage) never mismatches. */
export function useLastContextId(kind: ContextKind): string | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => readLastContextId(kind),
    () => null
  );
}

/** The remembered entry while it still exists, otherwise the first one. */
export function pickContextId(options: { id: string }[], lastId: string | null): string | null {
  if (lastId && options.some((option) => option.id === lastId)) return lastId;
  return options[0]?.id ?? null;
}
