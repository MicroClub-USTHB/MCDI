'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { DOCS_NAV } from '@/features/docs/nav';
import clsx from 'clsx';

interface DocsSidebarProps {
  /** Called when a page is chosen, so the mobile drawer can close. */
  onNavigate?: () => void;
}

/** The sections and pages of the docs, from the nav config, with the current page marked. */
export function DocsSidebar({ onNavigate }: DocsSidebarProps) {
  const pathname = usePathname();
  const current = pathname.replace(/^\/docs\/?/, '').replace(/\/$/, '');

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6">
      {DOCS_NAV.map((section) => {
        const headingId = `docs-nav-${section.title.toLowerCase().replace(/\s+/g, '-')}`;
        return (
          <div
            key={section.title}
            role="group"
            aria-labelledby={headingId}
            className="flex flex-col gap-1"
          >
            <p
              id={headingId}
              className="px-3 paragraph-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {section.title}
            </p>
            {section.pages.map((page) => {
              const isCurrent = page.slug === current;
              return (
                <Link
                  key={page.slug}
                  href={`/docs/${page.slug}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={onNavigate}
                  className={clsx(
                    'rounded-md px-3 py-2 paragraph-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    isCurrent
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {page.title}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
