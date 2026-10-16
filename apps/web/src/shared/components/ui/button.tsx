import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

/**
 * shadcn/ui Button, restyled onto the MCID V2 tokens.
 *
 * Upstream ships `bg-primary` / `text-primary-foreground` / `bg-destructive`
 * / `ring-ring`, none of which exist in this project's `@theme`, plus `dark:`
 * variants that the dark-only design system forbids. Every class below
 * resolves to a real token in `globals.css`.
 *
 * Radius is `rounded-md` (6px) per the directive's "Buttons 6px", and label
 * type is `paragraph-sm` (14px/500) — the only role in the scale sized for a
 * control.
 */
const buttonVariants = cva(
  cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md paragraph-sm whitespace-nowrap',
    'transition-colors outline-none',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-60',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
  ),
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
        secondary:
          'border border-border bg-muted text-foreground hover:bg-muted active:bg-secondary',
        danger: 'bg-error text-primary-foreground hover:bg-error/90 active:bg-error/80',
        success: 'bg-success text-primary-foreground hover:bg-success/90 active:bg-success/80',
        ghost: 'bg-transparent text-foreground hover:bg-muted active:bg-secondary',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 gap-2 px-4',
        md: 'h-11 gap-2 px-6',
        lg: 'h-12 gap-3 px-8',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

function Button({
  className,
  variant = 'primary',
  size = 'md',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
