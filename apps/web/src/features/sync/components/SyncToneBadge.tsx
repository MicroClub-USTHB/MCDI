import type { ReactNode } from 'react';

import { McBadge } from '@/shared/components/ui/mc-badge';
import { cn } from '@/shared/lib/utils';
import type { SyncTone } from '@/features/sync/api/mappers';

const TONE_CLASSES: Record<SyncTone, string> = {
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  error: '',
  neutral: '',
};

/** Status pill for a sync tone: success and warning use their state colours on an outline badge. */
export function SyncToneBadge({
  tone,
  className,
  children,
}: {
  tone: SyncTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <McBadge
      variant={tone === 'error' ? 'destructive' : 'outline'}
      className={cn('w-fit', TONE_CLASSES[tone], className)}
    >
      {children}
    </McBadge>
  );
}
