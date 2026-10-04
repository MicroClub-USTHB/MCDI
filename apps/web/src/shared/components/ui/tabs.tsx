import * as React from 'react';
import { Tabs as RadixTabs } from 'radix-ui';

import { cn } from '@/shared/lib/utils';

function Tabs(props: React.ComponentProps<typeof RadixTabs.Root>) {
  return <RadixTabs.Root data-slot="tabs" {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List data-slot="tabs-list" className={cn('flex gap-1', className)} {...props} />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'rounded-md px-3 py-1.5 text-body text-text-muted transition-colors outline-none',
        'hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-border-focus',
        'data-[state=active]:bg-surface-active data-[state=active]:text-text-primary',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content
      data-slot="tabs-content"
      className={cn('outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
