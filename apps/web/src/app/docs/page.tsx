import Link from 'next/link';

import { DOCS_NAV } from '@/features/docs/nav';

export default function DocsHome() {
  return (
    <div className="px-4 py-10 sm:px-8">
      <div className="max-w-[70ch]">
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary">
          MCDI developer documentation
        </h1>
        <p className="mt-3 max-w-[60ch] text-lead text-text-muted">
          How MCDI works, how to use it from your project, and how to work on it.
        </p>
      </div>
      <div className="mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
        {DOCS_NAV.map((section) => (
          <section key={section.title} className="rounded-lg border border-border p-5">
            <h2 className="text-heading text-text-primary">{section.title}</h2>
            <p className="mt-1 text-body text-text-muted">{section.description}</p>
            <ul className="mt-4 flex flex-col gap-1">
              {section.pages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`}
                    className="rounded-sm text-body text-brand-light underline-offset-4 outline-none hover:text-text-primary hover:underline focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
