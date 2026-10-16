import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { docNeighbours } from '@/features/docs/nav';

const LINK =
  'group flex flex-1 flex-col gap-1 rounded-lg border border-border p-4 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring';

/** Previous and next page, in nav order, at the end of an article. */
export function DocPager({ slug }: { slug: string }) {
  const { prev, next } = docNeighbours(slug);
  if (!prev && !next) return null;

  return (
    <nav aria-label="Previous and next pages" className="mt-16 flex flex-col gap-3 sm:flex-row">
      {prev ? (
        <Link href={`/docs/${prev.slug}`} className={LINK}>
          <span className="flex items-center gap-1 paragraph-xs font-semibold tracking-wide text-muted-foreground">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Previous
          </span>
          <span className="paragraph-sm font-semibold text-foreground">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link href={`/docs/${next.slug}`} className={`${LINK} sm:items-end sm:text-right`}>
          <span className="flex items-center gap-1 paragraph-xs font-semibold tracking-wide text-muted-foreground">
            Next
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
          <span className="paragraph-sm font-semibold text-foreground">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
