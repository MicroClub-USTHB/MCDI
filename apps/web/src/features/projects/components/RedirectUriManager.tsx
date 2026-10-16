'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';

import { McButton } from '@/shared/components/ui/mc-button';
import { McInput } from '@/shared/components/ui/mc-input';

interface RedirectUriManagerProps {
  uris: string[];
  /** Render as a plain list — hides the add form and remove actions. */
  readOnly?: boolean;
  onAdd: (uri: string) => void;
  onRemove: (uri: string) => void;
  isSubmitting?: boolean;
}

function isValidUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Controlled list of a project's redirect URIs. The backend stores them as one
 * comma-separated string and exposes it only through routed mutation responses,
 * so the parent owns the source of truth and passes `uris` in (see the detail
 * view, which joins them back into the comma-separated string on save).
 */
function RedirectUriManager({
  uris,
  readOnly = false,
  onAdd,
  onRemove,
  isSubmitting = false,
}: RedirectUriManagerProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  function handleAdd(event: FormEvent) {
    event.preventDefault();
    const uri = draft.trim();
    if (uri.length === 0) return;
    if (!isValidUri(uri)) {
      setError('Enter a valid URL');
      return;
    }
    setError(undefined);
    setDraft('');
    onAdd(uri);
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-muted-foreground">Redirect URIs</span>
      {!readOnly && (
        <form onSubmit={handleAdd} className="flex items-start gap-2">
          <McInput
            className="flex-1"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            error={error}
            aria-label="New redirect URI"
            placeholder="https://app.example.com/auth/callback"
            disabled={isSubmitting}
          />
          <McButton
            type="submit"
            variant="secondary"
            size="md"
            icon="leading"
            iconDefinition={<Plus aria-hidden="true" />}
            disabled={isSubmitting}
          >
            Add
          </McButton>
        </form>
      )}
      {uris.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {uris.map((uri) => (
            <li
              key={uri}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                {uri}
              </code>
              {!readOnly && (
                <McButton
                  type="button"
                  variant="tertiary"
                  size="sm"
                  icon="only"
                  iconDefinition={<X aria-hidden="true" />}
                  disabled={isSubmitting}
                  onClick={() => onRemove(uri)}
                >
                  {`Remove ${uri}`}
                </McButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="paragraph-xs text-muted-foreground">No redirect URIs set.</p>
      )}
    </div>
  );
}

export { RedirectUriManager, type RedirectUriManagerProps };
