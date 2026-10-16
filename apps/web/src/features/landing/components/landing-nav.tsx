import Link from 'next/link';
import { Fingerprint } from 'lucide-react';

import { LANDING } from '@/features/landing/content';
import { Button } from '@/shared/components/ui/button';

export function LandingNav() {
  return (
    <header className="relative z-10">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md paragraph-md font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary"
          >
            <Fingerprint className="size-4" />
          </span>
          {LANDING.name}
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link href={LANDING.signIn.href}>{LANDING.signIn.label}</Link>
        </Button>
      </nav>
    </header>
  );
}
