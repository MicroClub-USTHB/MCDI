import clsx from 'clsx';

// Outlined badges on the page background, so every colour keeps 4.5:1 contrast without a tinted fill.
const METHOD_COLOURS: Record<string, string> = {
  GET: 'text-brand-light',
  POST: 'text-success',
  PUT: 'text-warning',
  PATCH: 'text-warning',
  DELETE: 'text-accent',
};

/** The method and path of an API operation, as one line that wraps inside its box. */
export function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div
      role="group"
      aria-label={`${method} ${path}`}
      className="my-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-base px-3 py-2"
    >
      <span
        className={clsx(
          'rounded-sm border border-current px-2 py-0.5 font-mono text-overline',
          METHOD_COLOURS[method] ?? 'text-text-muted'
        )}
      >
        {method}
      </span>
      <code className="min-w-0 font-mono text-code break-all text-text-primary">{path}</code>
    </div>
  );
}
