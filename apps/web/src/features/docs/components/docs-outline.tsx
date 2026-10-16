'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

import type { DocHeadingInfo } from '@/features/docs/headings';

/**
 * "On this page": the h2 and h3 of the article (worked out on the server from the page source, so
 * it is there with the first paint). Here in the browser it only notes which heading is nearest
 * the top of the screen.
 */
export function DocsOutline({ headings }: { headings: DocHeadingInfo[] }) {
  const [active, setActive] = useState<string | null>(null);
  const shown = headings.filter((heading) => heading.level <= 3);

  useEffect(() => {
    const elements = shown
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries.find((entry) => entry.isIntersecting);
        if (first) setActive(first.target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' }
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
    // `shown` is derived from `headings`, which is stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headings]);

  if (shown.length < 2) return null;

  return (
    <nav aria-label="On this page" className="sticky top-24 flex flex-col gap-1">
      <p className="px-2 paragraph-xs font-semibold tracking-wide text-muted-foreground uppercase">
        On this page
      </p>
      {shown.map((heading) => (
        <a
          key={heading.id}
          href={`#${heading.id}`}
          aria-current={heading.id === active ? 'location' : undefined}
          className={clsx(
            'rounded-sm px-2 py-1 paragraph-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
            heading.level === 3 && 'pl-5',
            heading.id === active
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}
