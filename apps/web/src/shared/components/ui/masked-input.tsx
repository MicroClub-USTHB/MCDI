'use client';

import * as React from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

interface MaskedInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onCopy'> {
  value: string;
  /** Masks the displayed value behind `maskChar` until the reveal toggle is pressed. */
  secret?: boolean;
  maskChar?: string;
  copyLabel?: string;
  revealLabel?: string;
  /** Called after a successful copy; used to drive e.g. a toast. */
  onCopy?: () => void;
  showRevealToggle?: boolean;
}

/**
 * Read-only, copyable code-field for secrets. The value sits in a
 * `font-mono` block on `surface-base` (per the design directive for API-key
 * display); a `secret` value renders as a repeated mask character until the
 * eye toggle shows it. Copy uses the async Clipboard API and flips to a
 * temporary check.
 */
function MaskedInput({
  value,
  secret = false,
  maskChar = '•',
  copyLabel,
  revealLabel,
  onCopy,
  showRevealToggle = true,
  className,
  ...props
}: MaskedInputProps) {
  const [visible, setVisible] = React.useState(!secret);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const displayed = value || (secret ? maskChar.repeat(12) : '');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
      onCopy?.();
    } catch {
      // Clipboard access can be denied (permissions / non-HTTPS); the field
      // stays selectable so the fallback is a manual copy.
    }
  }

  return (
    <div className={cn('relative', className)}>
      <input
        readOnly
        data-slot="masked-input"
        value={secret && !visible ? maskChar.repeat(displayed.length || 12) : displayed}
        onFocus={(event) => event.currentTarget.select()}
        className="h-10 w-full min-w-0 rounded-md border border-border bg-surface-base pr-16 pl-3 font-mono text-code text-text-normal transition-colors outline-none focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-brand/20"
        {...props}
      />
      <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-1">
        {showRevealToggle && secret && (
          <button
            type="button"
            aria-label={revealLabel ?? (visible ? 'Hide value' : 'Reveal value')}
            className="flex size-8 items-center justify-center rounded-md text-text-faint transition-colors outline-none hover:bg-surface-hover hover:text-text-normal focus-visible:ring-2 focus-visible:ring-border-focus"
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        )}
        <button
          type="button"
          aria-label={copyLabel ?? 'Copy to clipboard'}
          className={cn(
            'flex size-8 items-center justify-center rounded-md transition-colors outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-border-focus',
            copied ? 'text-success' : 'text-text-faint hover:text-text-normal'
          )}
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

export { MaskedInput, type MaskedInputProps };
