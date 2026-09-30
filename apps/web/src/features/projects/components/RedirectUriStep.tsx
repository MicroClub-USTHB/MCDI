'use client';

import { useState, type FormEvent } from 'react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface RedirectUriStepProps {
  projectId: string;
  isSubmitting?: boolean;
  submitLabel?: string;
  onSubmit: (redirectUri: string) => void;
}

function splitUris(value: string): string[] {
  return value
    .split(',')
    .map((uri) => uri.trim())
    .filter((uri) => uri.length > 0);
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
 * Step 2 of project creation. The backend only accepts the redirect URI via a
 * separate `PATCH /admin/projects/:id/redirect-uri` after the project exists,
 * so this runs after step 1. A comma-separated list is stored as-is and must
 * match `GET /auth/authorize` values exactly.
 */
function RedirectUriStep({
  projectId,
  isSubmitting = false,
  submitLabel = 'Finish',
  onSubmit,
}: RedirectUriStepProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const uris = splitUris(value);
    if (uris.length === 0) {
      setError('Enter at least one redirect URI');
      return;
    }
    const invalid = uris.find((uri) => !isValidUri(uri));
    if (invalid) {
      setError(`"${invalid}" is not a valid URL`);
      return;
    }
    setError(undefined);
    onSubmit(uris.join(', '));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`redirect-uri-${projectId}`}>Redirect URI(s)</Label>
        <Input
          id={`redirect-uri-${projectId}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          placeholder="https://app.example.com/auth/callback, https://app.example.com/oauth2/callback"
          disabled={isSubmitting}
        />
        <p className="text-overline text-text-subtle">
          Comma-separated for multiple values. The value used in{' '}
          <code className="font-mono text-text-normal">/auth/authorize</code> must match one
          exactly.
        </p>
        {error && <p className="text-overline text-error">{error}</p>}
      </div>
      <Button type="submit" size="md" disabled={isSubmitting} className="self-end">
        {isSubmitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

export { RedirectUriStep, type RedirectUriStepProps };
