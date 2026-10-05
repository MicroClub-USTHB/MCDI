import type { ReactNode } from 'react';

/** Turns the numbered list inside into a procedure with numbered markers. */
export function Steps({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        'my-6 [counter-reset:step]',
        '[&>ol]:m-0 [&>ol]:list-none [&>ol]:space-y-6 [&>ol]:p-0',
        '[&>ol>li]:relative [&>ol>li]:pl-11 [&>ol>li]:[counter-increment:step]',
        '[&>ol>li]:before:absolute [&>ol>li]:before:top-0 [&>ol>li]:before:left-0',
        '[&>ol>li]:before:flex [&>ol>li]:before:size-8 [&>ol>li]:before:items-center [&>ol>li]:before:justify-center',
        '[&>ol>li]:before:rounded-full [&>ol>li]:before:bg-surface-active [&>ol>li]:before:text-subhead',
        '[&>ol>li]:before:text-text-primary [&>ol>li]:before:content-[counter(step)]',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
