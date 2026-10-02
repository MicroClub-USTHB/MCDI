import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

/**
 * shadcn/ui Badge, restyled onto the MCDI V2 tokens.
 *
 * Upstream ships `bg-primary` / `bg-destructive` / `dark:` variants, none of
 * which exist here. Variants below map to the directive's pill usages:
 * `brand` for a flagship tag (e.g. "MAIN"), `brand-light` for a secondary tag
 * (e.g. "partner"), and `success`/`error`/`warning` for status pills
 * (online/offline/syncing) using a tinted background over the semantic text
 * color.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-1 text-overline whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        brand: 'bg-brand text-on-brand',
        'brand-light': 'bg-brand-tint text-brand-light',
        secondary: 'bg-surface-elevated text-text-normal',
        outline: 'border-border bg-transparent text-text-normal',
        success: 'bg-success/15 text-success',
        error: 'bg-error/15 text-error',
        warning: 'bg-warning/15 text-warning',
      },
    },
    defaultVariants: {
      variant: 'brand',
    },
  }
);

function Badge({
  className,
  variant = 'brand',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
