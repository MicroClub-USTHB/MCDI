'use client';

import { Popover } from 'radix-ui';
import { Columns3 } from 'lucide-react';

import type { SubmissionColumn } from '@/features/inbound-webhooks/api/submission-columns';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';

interface ColumnsMenuProps {
  available: SubmissionColumn[];
  selected: string[];
  onChange: (paths: string[]) => void;
  onReset: () => void;
}

/** Which answers the table shows, in schema order whatever order they were ticked in. */
export function ColumnsMenu({ available, selected, onChange, onReset }: ColumnsMenuProps) {
  function toggle(path: string) {
    const next = selected.includes(path)
      ? selected.filter((item) => item !== path)
      : [...selected, path];
    onChange(available.map((column) => column.path).filter((item) => next.includes(item)));
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Columns3 aria-hidden="true" />
          Columns
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 flex max-h-80 w-72 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-surface-elevated p-2 shadow-divider"
        >
          {available.length === 0 ? (
            <p className="px-2 py-1 text-body text-text-subtle">This schema has no fields.</p>
          ) : (
            available.map((column) => (
              <label
                key={column.path}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover"
              >
                <Checkbox
                  checked={selected.includes(column.path)}
                  onCheckedChange={() => toggle(column.path)}
                  aria-label={column.path}
                />
                <span className="font-mono text-code break-all text-text-normal">
                  {column.path}
                </span>
              </label>
            ))
          )}
          <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={onReset}>
            Show the first three
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
