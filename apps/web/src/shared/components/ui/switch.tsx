import * as React from 'react';
import { Switch as RadixSwitch } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

function Switch({ className, ...props }: React.ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=checked]:bg-brand data-[state=unchecked]:bg-surface-elevated',
        className
      )}
      {...props}
    >
      <RadixSwitch.Thumb
        className={cn(
          'pointer-events-none block size-5 translate-x-0.5 rounded-full bg-on-brand shadow-divider transition-transform',
          'data-[state=checked]:translate-x-[18px]'
        )}
      />
    </RadixSwitch.Root>
  );
}

export { Switch };
