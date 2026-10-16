import * as React from 'react';
import { Select as RadixSelect } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

const Select = RadixSelect.Root;
const SelectValue = RadixSelect.Value;

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect.Trigger>) {
  return (
    <RadixSelect.Trigger
      data-slot="select-trigger"
      className={cn(
        'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1 paragraph-sm text-foreground transition-colors outline-none',
        'data-[placeholder]:text-muted-foreground/70',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground/70" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        data-slot="select-content"
        position={position}
        className={cn(
          'z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-md border border-border bg-card p-1 text-foreground shadow-md',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className
        )}
        {...props}
      >
        <RadixSelect.Viewport>{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-pointer items-center gap-2 rounded-md py-1.5 pr-8 pl-2 paragraph-sm outline-none select-none',
        'data-[highlighted]:bg-muted',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2 flex items-center">
        <Check className="size-4 text-primary" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem };
