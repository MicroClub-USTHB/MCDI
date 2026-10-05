'use client';

import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

const COPIED_FOR_MS = 1500;

/** The language the highlighter recorded on the code element, if any. */
function languageOf(children: ReactNode): string | null {
  for (const child of Children.toArray(children)) {
    if (!isValidElement<{ className?: string }>(child)) continue;
    const match = child.props.className?.match(/language-([\w-]+)/);
    if (match) return match[1] ?? null;
  }
  return null;
}

/** A fenced code block: the language, a copy button, and sideways scrolling inside its own box. */
export function CodeBlock({ children, ...props }: ComponentProps<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [copied, setCopied] = useState(false);
  const language = languageOf(children);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(preRef.current?.textContent ?? '');
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_FOR_MS);
    } catch {
      // The browser can refuse clipboard access; the code stays selectable by hand.
    }
  }

  return (
    <div className="my-5 overflow-hidden rounded-lg border border-border bg-surface-base">
      <div className="flex h-9 items-center justify-between border-b border-border bg-surface-raised px-3">
        <span className="font-mono text-overline text-text-subtle">{language ?? ''}</span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-overline text-text-muted outline-none hover:bg-surface-hover hover:text-text-normal focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          {copied ? (
            <Check className="size-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <span role="status" className="sr-only">
          {copied ? 'Copied to clipboard' : ''}
        </span>
      </div>
      <pre
        ref={preRef}
        tabIndex={0}
        aria-label={`${language ?? 'Code'} example`}
        className="overflow-x-auto p-4 font-mono text-code text-text-normal [font-variant-ligatures:none] outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset"
        {...props}
      >
        {children}
      </pre>
    </div>
  );
}
