import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

/**
 * shadcn/ui Input, restyled onto the MCDI V2 tokens.
 *
 * Upstream uses `border-input` / `bg-input/30` / `selection:bg-primary` /
 * `dark:` variants, none of which exist here. Surface is `surface-main` per
 * the directive ("Main: inputs"), radius is `rounded-md` (6px, matching
 * buttons), and label type is `text-body`.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-9 w-full min-w-0 rounded-md border border-border bg-surface-main px-3 py-1 text-body text-text-normal transition-colors outline-none',
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

/**
 * Search variant of Input — a leading `Search` icon over the same token
 * styling, for the directive's "Search..." field.
 */
function SearchInput({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<'input'> & { containerClassName?: string }) {
  return (
    <div className={cn('relative', containerClassName)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-faint"
        aria-hidden="true"
      />
      <Input type="search" className={cn('pl-9', className)} {...props} />
    </div>
  );
}

export { Input, SearchInput };
