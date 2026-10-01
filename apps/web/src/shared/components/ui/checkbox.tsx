import * as React from 'react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import { Check } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<typeof RadixCheckbox.Root>) {
  return (
    <RadixCheckbox.Root
      data-slot="checkbox"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-border bg-surface-main transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand',
        className
      )}
      {...props}
    >
      <RadixCheckbox.Indicator>
        <Check className="size-3 text-on-brand" strokeWidth={3} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );
}

export { Checkbox };
