import type { ReactNode } from 'react';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

const TYPES = {
  note: { label: 'Note', Icon: Info, box: 'border-info/30 bg-info/10', icon: 'text-brand-light' },
  tip: {
    label: 'Tip',
    Icon: Lightbulb,
    box: 'border-success/30 bg-success/10',
    icon: 'text-success',
  },
  warning: {
    label: 'Warning',
    Icon: AlertTriangle,
    box: 'border-warning/30 bg-warning/10',
    icon: 'text-warning',
  },
} as const;

interface CalloutProps {
  type?: keyof typeof TYPES;
  children: ReactNode;
}

/** Draws attention to something. The label says what kind it is, so colour is never the only cue. */
export function Callout({ type = 'note', children }: CalloutProps) {
  const { label, Icon, box, icon } = TYPES[type];

  return (
    <aside role="note" className={cn('my-6 flex gap-3 rounded-lg border p-4', box)}>
      <Icon className={cn('mt-0.5 size-4 shrink-0', icon)} aria-hidden="true" />
      <div className="min-w-0 text-body text-text-normal">
        <p className="m-0 text-subhead text-text-primary">{label}</p>
        <div className="[&>p]:my-1">{children}</div>
      </div>
    </aside>
  );
}
