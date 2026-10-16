import { cn } from '@/shared/lib/utils';
import type { ServerType } from '@/features/servers/types';

interface ServerTypeBadgeProps {
  type: ServerType;
  className?: string;
}

const TYPE_CONFIG: Record<ServerType, { label: string; classes: string }> = {
  main: { label: 'Main', classes: 'bg-primary/15 text-primary' },
  competition: { label: 'Competition', classes: 'bg-success/12 text-success' },
  event: { label: 'Event', classes: 'bg-accent/12 text-accent' },
  other: { label: 'Other', classes: 'bg-muted text-muted-foreground' },
};

function ServerTypeBadge({ type, className }: ServerTypeBadgeProps) {
  const config = TYPE_CONFIG[type];

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 paragraph-xs font-semibold tracking-wide whitespace-nowrap',
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export { ServerTypeBadge, type ServerTypeBadgeProps };
