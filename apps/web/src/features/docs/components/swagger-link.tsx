import { ExternalLink } from 'lucide-react';

import { API_REFERENCE_HREF } from '@/features/docs/links';

/** A link to one operation in the API's Swagger page, where it can be tried. */
export function SwaggerLink({ tag, operationId }: { tag: string; operationId: string }) {
  const href = `${API_REFERENCE_HREF}#/${encodeURIComponent(tag)}/${encodeURIComponent(operationId)}`;

  return (
    <p className="my-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-sm text-body text-brand-light underline underline-offset-4 outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        Open in Swagger
        <ExternalLink className="size-3.5" aria-hidden="true" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
