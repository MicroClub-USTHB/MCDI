'use client';

import { Columns3 } from 'lucide-react';

import type { SubmissionColumn } from '@/features/inbound-webhooks/api/submission-columns';
import { McButton } from '@/shared/components/ui/mc-button';
import { McCheckbox } from '@/shared/components/ui/mc-checkbox';
import { McPopover, McPopoverContent, McPopoverTrigger } from '@/shared/components/ui/mc-popover';

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
    <McPopover>
      <McPopoverTrigger
        render={
          <McButton
            type="button"
            variant="secondary"
            size="sm"
            icon="leading"
            iconDefinition={<Columns3 aria-hidden="true" />}
          />
        }
      >
        Columns
      </McPopoverTrigger>
      <McPopoverContent
        align="end"
        sideOffset={6}
        className="max-h-80 w-72 gap-1 border border-border p-2"
      >
        {available.length === 0 ? (
          <p className="px-2 py-1 paragraph-sm text-muted-foreground">This schema has no fields.</p>
        ) : (
          available.map((column) => (
            <McCheckbox
              key={column.path}
              checked={selected.includes(column.path)}
              onCheckedChange={() => toggle(column.path)}
              text={column.path}
              className="w-full gap-3 rounded-md px-2 py-1.5 hover:bg-muted [&>span]:min-w-0 [&_span_span]:font-mono [&_span_span]:text-xs [&_span_span]:break-all"
            />
          ))
        )}
        <McButton type="button" variant="tertiary" size="sm" className="mt-1" onClick={onReset}>
          Show the first three
        </McButton>
      </McPopoverContent>
    </McPopover>
  );
}
