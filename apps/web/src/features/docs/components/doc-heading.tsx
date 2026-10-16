import type { ComponentProps, ReactNode } from 'react';

import clsx from 'clsx';

// `clsx`, not `cn`: tailwind-merge does not know the custom font-size tokens and would drop them next to a colour class.

const STYLES = {
  2: 'mt-12 mb-4 header-xs font-bold text-foreground',
  3: 'mt-8 mb-3 paragraph-md font-semibold text-foreground',
  4: 'mt-6 mb-2 paragraph-sm font-semibold text-foreground',
} as const;

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

type DocHeadingProps = ComponentProps<'h2'> & { level: 2 | 3 | 4 };

/** A section heading that links to itself (`rehype-slug` supplies the id), for sharing a spot in a page. */
export function DocHeading({ level, id, children, className, ...props }: DocHeadingProps) {
  const Tag = `h${level}` as const;

  return (
    <Tag id={id} className={clsx('group scroll-mt-24', STYLES[level], className)} {...props}>
      {children}
      {id ? (
        <a
          href={`#${id}`}
          aria-label={`Link to ${textOf(children)}`}
          className="ml-2 rounded-sm text-muted-foreground no-underline opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden="true">#</span>
        </a>
      ) : null}
    </Tag>
  );
}
