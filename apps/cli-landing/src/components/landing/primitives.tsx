'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { McButton } from '@/components/ui/mc-button';
import { toast } from '@/components/ui/mc-sonner';
import { McTooltip, McTooltipContent, McTooltipTrigger } from '@/components/ui/mc-tooltip';
import { cn } from '@/lib/utils';

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true once running in the browser. */
export function useMounted() {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/** Icon-only mcoli-ui button that copies `value`, with a tooltip and a toast as feedback. */
export function CopyButton({
  value,
  label = 'Copy command',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy', { description: 'Your browser blocked clipboard access.' });
    }
  };

  return (
    <McTooltip>
      <McTooltipTrigger
        render={
          <McButton
            variant="tertiary"
            size="sm"
            icon="only"
            iconDefinition={copied ? <Check className="text-success" /> : <Copy />}
            onClick={copy}
            aria-label={label}
            className={cn('[&_svg]:size-4', className)}
          />
        }
      />
      <McTooltipContent description={copied ? 'Copied' : label} />
    </McTooltip>
  );
}

/** A short fade-up the first time an element scrolls into view. Off under reduced motion. */
export function Reveal({
  className,
  delay = 0,
  children,
  ...props
}: React.ComponentProps<'div'> & { delay?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn('reveal', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <Reveal className="mb-10 flex max-w-2xl flex-col gap-3 sm:mb-12">
      <p className="paragraph-sm font-semibold tracking-wider text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="header-xs font-bold text-foreground sm:header-sm">
        {title}
      </h2>
      {description ? <p className="paragraph-md text-muted-foreground">{description}</p> : null}
    </Reveal>
  );
}

export function Container({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8', className)} {...props} />;
}

export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={cn('size-4', className)}>
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

/** A command on a muted strip, with a copy button. */
export function CommandBlock({ command, className }: { command: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-2 rounded-lg border border-border bg-muted py-1.5 ps-4 pe-1.5',
        className
      )}
    >
      <pre className="min-w-0 py-1.5 font-mono paragraph-sm break-words whitespace-pre-wrap text-foreground">
        <span className="text-muted-foreground select-none">$ </span>
        {command}
      </pre>
      <CopyButton value={command} />
    </div>
  );
}
