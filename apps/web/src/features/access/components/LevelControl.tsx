'use client';

import { cn } from '@/shared/lib/utils';

export interface LevelOption<V extends string> {
  value: V;
  label: string;
}

interface LevelControlProps<V extends string> {
  /** Radio group name: unique per control on the page. */
  name: string;
  label: string;
  description?: string;
  /** A warning shown under the control. */
  hint?: string;
  value: V;
  options: LevelOption<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
}

/** A segmented control built on native radios: labelled group, arrow keys and focus come for free. */
export function LevelControl<V extends string>({
  name,
  label,
  description,
  hint,
  value,
  options,
  onChange,
  disabled = false,
}: LevelControlProps<V>) {
  return (
    <fieldset
      disabled={disabled}
      className="flex min-w-0 flex-col gap-2 border-0 p-0 py-3 first:pt-0 last:pb-0"
    >
      <legend className="float-left w-full text-body text-text-primary">{label}</legend>
      {description ? (
        <p className="clear-both text-overline text-text-subtle">{description}</p>
      ) : (
        <span className="clear-both" />
      )}
      <div className="inline-flex w-fit max-w-full flex-wrap rounded-md border border-border bg-surface-base p-0.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'cursor-pointer rounded-sm px-3 py-1.5 text-body transition-colors',
              'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-border-focus',
              'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60',
              value === option.value
                ? 'bg-surface-active text-text-primary'
                : 'text-text-muted hover:bg-surface-hover hover:text-text-normal'
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint ? <p className="text-overline text-warning">{hint}</p> : null}
    </fieldset>
  );
}
