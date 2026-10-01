import { cn } from '@/shared/lib/utils';
import type { ServerType } from '@/features/servers/types';

interface ServerTypeBadgeProps {
  type: ServerType;
  className?: string;
}

const TYPE_CONFIG: Record<ServerType, { label: string; classes: string }> = {
  main: { label: 'Main', classes: 'bg-brand/15 text-brand-light' },
  competition: { label: 'Competition', classes: 'bg-success/12 text-success' },
  event: { label: 'Event', classes: 'bg-accent/12 text-accent' },
  other: { label: 'Other', classes: 'bg-surface-elevated text-text-muted' },
};

function ServerTypeBadge({ type, className }: ServerTypeBadgeProps) {
  const config = TYPE_CONFIG[type];

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-overline whitespace-nowrap',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export { ServerTypeBadge, type ServerTypeBadgeProps };
