import { cn } from '@/shared/lib/utils';

interface ServerAvatarProps {
  name: string;
  icon?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'size-8 paragraph-xs font-semibold tracking-wide',
  md: 'size-10 paragraph-sm',
  lg: 'size-14 paragraph-sm font-semibold',
} as const;

/** One of `brand`/`success`/`accent`, chosen deterministically from the server name. */
const COLOR_CLASSES = ['bg-primary', 'bg-success', 'bg-accent'] as const;

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
}

function getColorClass(name: string): string {
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return COLOR_CLASSES[hash % COLOR_CLASSES.length]!;
}

function ServerAvatar({ name, icon, size = 'md', className }: ServerAvatarProps) {
  if (icon) {
    return (
      <img
        src={icon}
        alt={name}
        className={cn('rounded-[10px] object-cover', SIZE_CLASSES[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-[10px] font-semibold text-primary-foreground',
        SIZE_CLASSES[size],
        getColorClass(name),
        className
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  );
}

export { ServerAvatar, type ServerAvatarProps };
