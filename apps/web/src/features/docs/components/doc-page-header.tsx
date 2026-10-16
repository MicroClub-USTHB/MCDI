import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { findDoc } from '@/features/docs/nav';

/** The breadcrumbs, the page's one h1 and its description, all from the nav config. */
export function DocPageHeader({ slug }: { slug: string }) {
  const page = findDoc(slug);
  if (!page) return null;

  return (
    <div className="mb-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 paragraph-sm text-muted-foreground">
          <li>
            <Link
              href="/docs"
              className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Docs
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li>{page.section}</li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5" />
          </li>
          <li aria-current="page" className="text-foreground">
            {page.title}
          </li>
        </ol>
      </nav>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground">{page.title}</h1>
      <p className="mt-3 max-w-[60ch] paragraph-lg text-muted-foreground">{page.description}</p>
    </div>
  );
}
