import type { ComponentProps } from 'react';

/** A table that scrolls sideways inside its own box, so a wide one never widens the page. */
export function DocTable(props: ComponentProps<'table'>) {
  return (
    <div className="my-5 overflow-x-auto rounded-lg border border-border">
      <table
        className="w-full border-collapse text-left text-body [&_td]:border-t [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:bg-surface-raised [&_th]:px-3 [&_th]:py-2 [&_th]:text-overline [&_th]:text-text-subtle"
        {...props}
      />
    </div>
  );
}
