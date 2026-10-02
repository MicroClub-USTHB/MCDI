import { cn } from '@/shared/lib/utils';

interface ServerStatusBadgeProps {
  isActive: boolean;
  isMain: boolean;
  className?: string;
}

/** Main overrides Active/Inactive — a main server is always shown as "Main". */
function ServerStatusBadge({ isActive, isMain, className }: ServerStatusBadgeProps) {
  const label = isMain ? 'Main' : isActive ? 'Active' : 'Inactive';
  const toneClasses = isMain
    ? 'bg-brand text-on-brand'
    : isActive
      ? 'bg-success/12 text-success'
      : 'bg-error/12 text-error';

  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-overline whitespace-nowrap',
        toneClasses,
        className
      )}
    >
      {label}
    </span>
  );
}

export { ServerStatusBadge, type ServerStatusBadgeProps };
