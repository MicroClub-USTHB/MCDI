import { useMemo } from 'react';

import { useSchemaPreviewQuery } from '@/features/inbound-webhooks/api/queries';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';

const PREVIEW_DELAY_MS = 600;

export function parseSchemaText(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * The API's verdict on the schema text, asked 600 ms after the typing stops.
 * `verdict` is only `ok` for the text as it stands now: while a newer text waits
 * or is being checked, it says `checking`, so a save never rests on an older check.
 */
export function useSchemaPreview(text: string, name?: string) {
  const schema = useMemo(() => parseSchemaText(text), [text]);
  const settled = useDebouncedValue(schema, PREVIEW_DELAY_MS);
  const preview = useSchemaPreviewQuery(
    settled ? { schema: settled, name: name?.trim() || undefined } : null
  );

  const serverProblems = preview.data && !preview.data.ok ? preview.data.errors : undefined;
  const current = settled === schema && !preview.isFetching && !preview.isPlaceholderData;
  const verdict: 'invalid-json' | 'checking' | 'errors' | 'ok' =
    schema === null
      ? 'invalid-json'
      : !current || !preview.data
        ? 'checking'
        : preview.data.ok
          ? 'ok'
          : 'errors';

  return { schema, preview, serverProblems, verdict };
}
