import type { ComponentProps } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

const CLASSES =
  'rounded-sm text-brand-light underline underline-offset-4 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus';

/** Docs and in-page links stay put; links to other sites open in a new tab and say so. */
export function DocLink({ href = '', children, ...props }: ComponentProps<'a'>) {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={CLASSES} {...props}>
        {children}
      </Link>
    );
  }
  if (href.startsWith('#')) {
    return (
      <a href={href} className={CLASSES} {...props}>
        {children}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={CLASSES} {...props}>
      {children}
      <ExternalLink className="ml-1 inline size-3.5 align-baseline" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
