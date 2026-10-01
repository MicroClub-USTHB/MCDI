import * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * shadcn/ui Skeleton, restyled onto the MCDI V2 tokens.
 *
 * Upstream uses `bg-accent`, which in this design system is `#EB459E` — hot
 * pink. The placeholder surface is `surface-hover`.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-surface-hover', className)}
      {...props}
    />
  );
}

export { Skeleton };
