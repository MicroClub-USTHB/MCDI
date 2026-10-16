'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** localStorage key holding the member's choice; absent means "follow the system". */
export const THEME_STORAGE_KEY = 'mcid-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const CHANGE_EVENT = 'mcid-theme-change';

/**
 * Runs in <head> before the page paints (see `app/layout.tsx`), so the right
 * palette shows on the first frame instead of flashing light then dark.
 * Kept free of imports: it is serialised into an inline script.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem('${THEME_STORAGE_KEY}');var d=c==='dark'||(c!=='light'&&window.matchMedia('${DARK_QUERY}').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function readChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function applyChoice(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle('dark', dark);
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * The member's theme choice and a setter. `system` follows the operating
 * system and keeps following it when it changes; `light` and `dark` are stored
 * in localStorage. The `dark` class on <html> switches every mcoli-ui token.
 */
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  // The stored choice is only known in the browser; the server renders "system".
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as const);

  useEffect(() => {
    applyChoice(choice);
    if (choice !== 'system') return;
    const media = window.matchMedia(DARK_QUERY);
    const follow = () => applyChoice('system');
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the choice still applies to this page.
    }
    applyChoice(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [choice, setChoice];
}
