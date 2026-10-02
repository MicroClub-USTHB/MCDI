import * as React from 'react';
import { Label as RadixLabel } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof RadixLabel.Root>) {
  return (
    <RadixLabel.Root
      data-slot="label"
      className={cn(
        'text-body font-medium text-text-normal select-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export { Label };
