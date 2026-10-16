import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { McButton } from '@/shared/components/ui/mc-button';

interface EmptyStateProps extends React.ComponentProps<'div'> {
  /** A Lucide icon component (`icon={Users}`) or an already-rendered node (`icon={<Users className="size-6" />}`). */
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  /** Custom action node. Takes precedence over `actionLabel`/`onAction`. */
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/** Placeholder for a list or panel with nothing to show yet, on the mcoli-ui tokens. */
function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
  ...props
}: EmptyStateProps) {
  const iconNode = icon
    ? React.isValidElement(icon)
      ? icon
      : React.createElement(icon as React.ElementType, {
          className: 'size-6',
          'aria-hidden': true,
        })
    : null;

  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center',
        className
      )}
      {...props}
    >
      {iconNode && (
        <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          {iconNode}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="paragraph-md font-semibold text-foreground">{title}</p>
        {description && (
          <p className="max-w-md paragraph-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action ??
        (actionLabel && onAction ? (
          <McButton variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </McButton>
        ) : null)}
    </div>
  );
}

export { EmptyState, type EmptyStateProps };
