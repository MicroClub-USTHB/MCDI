import Link from 'next/link';
import { Fingerprint } from 'lucide-react';

import { LANDING } from '@/features/landing/content';
import { ThemeToggle } from '@/shared/components/common/ThemeToggle';
import { buttonVariants } from '@/shared/components/ui/mc-button';

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
            className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-primary to-purple-secondary-600 text-primary-foreground shadow-sm"
          >
            <Fingerprint className="size-4" />
          </span>
          {LANDING.name}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href={LANDING.signIn.href}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            {LANDING.signIn.label}
          </Link>
        </div>
      </nav>
    </header>
  );
}
