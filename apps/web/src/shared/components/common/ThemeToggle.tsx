'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { McButton } from '@/shared/components/ui/mc-button';
import { useThemeChoice, type ThemeChoice } from '@/shared/lib/theme';
import { McTooltip, McTooltipContent, McTooltipTrigger } from '@/shared/components/ui/mc-tooltip';

const ORDER: readonly ThemeChoice[] = ['system', 'light', 'dark'];

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

/** Cycles system → light → dark; the choice is kept in localStorage (see `shared/lib/theme`). */
export function ThemeToggle({ className }: { className?: string }) {
  const [current, setTheme] = useThemeChoice();
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
