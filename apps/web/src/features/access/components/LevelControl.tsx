'use client';

import { McRadioGroup, McRadioGroupItem } from '@/shared/components/ui/mc-radio-group';

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

/** One level per resource, as a labelled radio group (arrow keys and focus come from Base UI). */
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
      <legend className="float-left w-full paragraph-sm font-medium text-foreground">
        {label}
      </legend>
      {description ? (
        <p className="clear-both paragraph-xs text-muted-foreground">{description}</p>
      ) : (
        <span className="clear-both" />
      )}
      <McRadioGroup
        name={name}
        value={value}
        disabled={disabled}
        aria-label={label}
        onValueChange={(next) => {
          const option = options.find((item) => item.value === next);
          if (option) onChange(option.value);
        }}
        className="flex w-fit max-w-full flex-wrap gap-x-5 gap-y-2"
      >
        {options.map((option) => (
          <McRadioGroupItem
            key={option.value}
            value={option.value}
            text={option.label}
            disabled={disabled}
          />
        ))}
      </McRadioGroup>
      {hint ? <p className="paragraph-xs font-medium text-warning">{hint}</p> : null}
    </fieldset>
  );
}
