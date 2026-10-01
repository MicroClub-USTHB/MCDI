import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';

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
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center',
        className
      )}
      {...props}
    >
      {iconNode && <div className="text-text-faint">{iconNode}</div>}
      <div className="flex flex-col gap-1">
        <p className="text-subhead text-text-primary">{title}</p>
        {description && <p className="max-w-md text-body text-text-muted">{description}</p>}
      </div>
      {action ??
        (actionLabel && onAction ? (
          <Button variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null)}
    </div>
  );
}

export { EmptyState, type EmptyStateProps };
