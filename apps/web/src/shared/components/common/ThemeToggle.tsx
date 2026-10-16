'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { McButton } from '@/shared/components/ui/mc-button';
import { McTooltip, McTooltipContent, McTooltipTrigger } from '@/shared/components/ui/mc-tooltip';

const ORDER = ['system', 'light', 'dark'] as const;
type ThemeChoice = (typeof ORDER)[number];

const LABELS: Record<ThemeChoice, string> = {
  system: 'Theme: system',
  light: 'Theme: light',
  dark: 'Theme: dark',
};

const ICONS: Record<ThemeChoice, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const subscribe = () => () => {};

/** Cycles system → light → dark. The choice is stored by next-themes in localStorage. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known on the client; render the neutral icon until then.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const current: ThemeChoice =
    mounted && (theme === 'light' || theme === 'dark') ? theme : 'system';
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
  const Icon = ICONS[current];

  return (
    <McTooltip>
      <McTooltipTrigger
        render={
          <McButton
            variant="tertiary"
            size="sm"
            icon="only"
            iconDefinition={<Icon aria-hidden="true" />}
            className={className}
            onClick={() => setTheme(next)}
          >
            {`${LABELS[current]}. Switch to ${next}`}
          </McButton>
        }
      />
      <McTooltipContent>{LABELS[current]}</McTooltipContent>
    </McTooltip>
  );
}
