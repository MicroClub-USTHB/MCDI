'use client';

import { cn } from '@/shared/lib/utils';
import { Info } from 'lucide-react';

interface ImpactPreviewProps {
  affectedMembers: number;
  roleHolders: number;
  action: 'add' | 'remove';
}

function ImpactPreview({ affectedMembers, roleHolders, action }: ImpactPreviewProps) {
  const label =
    action === 'add'
      ? `${affectedMembers} member${affectedMembers !== 1 ? 's' : ''} will gain these permissions`
      : `${affectedMembers} member${affectedMembers !== 1 ? 's' : ''} will lose these permissions`;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-brand/20 bg-brand/15 px-4 py-3',
        'text-sm text-brand-light'
      )}
      role="status"
    >
      <Info className="size-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
      <span className="ml-auto text-xs text-brand/70">
        {roleHolders} total role holder{roleHolders !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

export { ImpactPreview };
export type { ImpactPreviewProps };
