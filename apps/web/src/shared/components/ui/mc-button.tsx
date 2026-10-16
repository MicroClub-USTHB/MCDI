'use client';

import * as React from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { type VariantProps } from 'class-variance-authority';
import { LinkIcon, Loader2 } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { buttonVariants } from '@/shared/components/ui/mc-button-variants';

export interface McButtonProps
  extends Omit<ButtonPrimitive.Props, 'icon'>, Omit<VariantProps<typeof buttonVariants>, 'icon'> {
  iconDefinition?: React.ReactNode;
  icon?: 'none' | 'leading' | 'trailing' | 'dot' | 'only';
  isLoading?: boolean;
}

function McButton({
  className,
  variant = 'primary',
  size,
  icon = 'none',
  destructive,
  iconDefinition,
  isLoading,
  children,
  disabled,
  ...props
}: McButtonProps) {
  const isLink = variant === 'link';
  const effectiveIcon =
    isLink && (icon === 'leading' || icon === 'trailing') && !iconDefinition ? (
      <LinkIcon />
    ) : (
      iconDefinition
    );

  return (
    <ButtonPrimitive
      data-slot="button"
      disabled={disabled || isLoading}
      className={cn(
        buttonVariants({
          variant,
          size,
          icon: icon === 'none' ? 'none' : icon,
          destructive,
          className,
        }),
        isLoading && 'gap-2'
      )}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin shrink-0" />
      ) : (
        <>
          {icon === 'dot' && (
            <span data-slot="dot" className="size-2.5 shrink-0 rounded-full bg-current" />
          )}
          {icon === 'leading' && effectiveIcon && (
            <span data-slot="leading-icon" className="size-4 shrink-0 [&_svg]:size-full">
              {effectiveIcon}
            </span>
          )}
        </>
      )}

      {icon !== 'only' && children}
      {icon === 'only' && !isLoading && effectiveIcon}
      {/* Icon-only buttons keep their children as the accessible name. */}
      {icon === 'only' && children ? <span className="sr-only">{children}</span> : null}

      {icon === 'trailing' && !isLoading && effectiveIcon && (
        <span data-slot="trailing-icon" className="size-4 shrink-0 [&_svg]:size-full">
          {effectiveIcon}
        </span>
      )}
    </ButtonPrimitive>
  );
}

export { McButton, buttonVariants };
