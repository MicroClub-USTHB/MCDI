import * as React from 'react';

import { cn } from '@/shared/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-20 w-full rounded-md border border-border bg-surface-main px-3 py-2 text-body text-text-normal transition-colors outline-none',
        'placeholder:text-text-faint',
        'focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-brand/20',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-error aria-invalid:ring-error/20',
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
