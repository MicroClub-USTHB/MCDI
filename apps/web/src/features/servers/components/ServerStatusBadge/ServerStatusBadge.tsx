import { McBadge } from '@/shared/components/ui/mc-badge';
import { cn } from '@/shared/lib/utils';

interface ServerStatusBadgeProps {
  isActive: boolean;
  isMain: boolean;
  className?: string;
}

/** Main overrides Active/Inactive — a main server is always shown as "Main". */
function ServerStatusBadge({ isActive, isMain, className }: ServerStatusBadgeProps) {
  const label = isMain ? 'Main' : isActive ? 'Active' : 'Inactive';
  if (isMain) {
    return (
      <McBadge variant="primary" className={cn('w-fit', className)}>
        {label}
      </McBadge>
    );
  }

  return (
    <McBadge
      variant={isActive ? 'outline' : 'destructive'}
      className={cn('w-fit', isActive && 'border-success/30 bg-success/10 text-success', className)}
    >
      {label}
    </McBadge>
  );
}

export { ServerStatusBadge, type ServerStatusBadgeProps };
