'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { useMounted } from '@/components/landing/primitives';
import { McSwitch } from '@/components/ui/mc-switch';

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <label className="flex items-center gap-2 text-muted-foreground">
      <Sun className="size-4" aria-hidden />
      {/* The resolved theme is only known in the browser; render it unchecked until then. */}
      <McSwitch
        size="sm"
        aria-label="Dark mode"
        checked={mounted && resolvedTheme === 'dark'}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
      />
      <Moon className="size-4" aria-hidden />
    </label>
  );
}
