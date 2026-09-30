import { Fragment } from 'react';
import Link from 'next/link';

import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbItem as BreadcrumbItemPrimitive,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb';

export interface BreadcrumbItem {
  label: string;
  /** Omitted on the last item — that's the current page, not a link. */
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Route-trail wrapper around the shadcn breadcrumb primitives — takes `items`, wires `href`s through `next/link`. */
function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <BreadcrumbRoot className={className}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItemPrimitive>
                {item.href && !isCurrent ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                )}
              </BreadcrumbItemPrimitive>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </BreadcrumbRoot>
  );
}

export { Breadcrumb };
