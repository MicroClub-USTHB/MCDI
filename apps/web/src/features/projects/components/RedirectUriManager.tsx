'use client';

import { useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

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
      <Label>Redirect URIs</Label>
      {!readOnly && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-label="New redirect URI"
            placeholder="https://app.example.com/auth/callback"
            disabled={isSubmitting}
          />
          <Button type="submit" variant="secondary" size="sm" disabled={isSubmitting}>
            <Plus aria-hidden="true" />
            Add
          </Button>
        </form>
      )}
      {error && <p className="text-overline text-error">{error}</p>}
      {uris.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {uris.map((uri) => (
            <li
              key={uri}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-base px-3 py-2"
            >
              <code className="min-w-0 flex-1 truncate font-mono text-code text-text-normal">
                {uri}
              </code>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${uri}`}
                  disabled={isSubmitting}
                  onClick={() => onRemove(uri)}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-overline text-text-faint">No redirect URIs set.</p>
      )}
    </div>
  );
}

export { RedirectUriManager, type RedirectUriManagerProps };
