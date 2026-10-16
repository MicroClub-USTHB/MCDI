import { Fragment } from 'react';
import Link from 'next/link';

import {
  McBreadcrumb,
  McBreadcrumbItem,
  McBreadcrumbLink,
  McBreadcrumbList,
  McBreadcrumbPage,
  McBreadcrumbSeparator,
} from '@/shared/components/ui/mc-breadcrumb';

export interface BreadcrumbItem {
  label: string;
  /** Omitted on the last item: that is the current page, not a link. */
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Route trail built on the mcoli-ui breadcrumb; takes `items` and links them with `next/link`. */
function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <McBreadcrumb className={className}>
      <McBreadcrumbList>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 && <McBreadcrumbSeparator />}
              <McBreadcrumbItem>
                {item.href && !isCurrent ? (
                  <McBreadcrumbLink render={<Link href={item.href} />}>
                    {item.label}
                  </McBreadcrumbLink>
                ) : (
                  <McBreadcrumbPage>{item.label}</McBreadcrumbPage>
                )}
              </McBreadcrumbItem>
            </Fragment>
          );
        })}
      </McBreadcrumbList>
    </McBreadcrumb>
  );
}

export { Breadcrumb };
