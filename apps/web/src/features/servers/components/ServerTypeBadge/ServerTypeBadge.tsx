import { McBadge } from '@/shared/components/ui/mc-badge';
import { cn } from '@/shared/lib/utils';
import type { ServerType } from '@/features/servers/types';

interface ServerTypeBadgeProps {
  type: ServerType;
  className?: string;
}

const TYPE_CONFIG: Record<
  ServerType,
  { label: string; variant: 'default' | 'secondary' | 'outline'; classes?: string }
> = {
  main: { label: 'Main', variant: 'default' },
  competition: {
    label: 'Competition',
    variant: 'outline',
    classes: 'border-success/30 bg-success/10 text-success',
  },
  event: { label: 'Event', variant: 'secondary' },
  other: { label: 'Other', variant: 'outline', classes: 'bg-muted text-muted-foreground' },
};

function ServerTypeBadge({ type, className }: ServerTypeBadgeProps) {
  const config = TYPE_CONFIG[type];

  return (
    <McBadge variant={config.variant} className={cn('w-fit', config.classes, className)}>
      {config.label}
    </McBadge>
  );
}

export { ServerTypeBadge, type ServerTypeBadgeProps };
