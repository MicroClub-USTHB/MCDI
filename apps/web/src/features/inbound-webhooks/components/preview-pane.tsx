'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { SchemaPreviewDto } from '@/features/inbound-webhooks/types';

interface PreviewPaneProps {
  preview: SchemaPreviewDto | undefined;
  /** The text is not valid JSON yet, so there is nothing to ask the API about. */
  waitingForJson: boolean;
  isFetching: boolean;
}

/** The docs the schema would produce and an example payload, as the API renders them. */
export function PreviewPane({ preview, waitingForJson, isFetching }: PreviewPaneProps) {
  let body;
  if (!preview) {
    body = (
      <p className="text-body text-text-subtle">
        {waitingForJson ? 'Fix the JSON to see the preview.' : 'Checking the schema…'}
      </p>
    );
  } else if (!preview.ok) {
    body = (
      <p className="text-body text-text-subtle">
        The schema has {preview.errors.length}{' '}
        {preview.errors.length === 1 ? 'problem' : 'problems'}. Fix{' '}
        {preview.errors.length === 1 ? 'it' : 'them'} to see the docs and an example payload.
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-overline text-text-subtle">Example payload</h3>
          <pre className="mt-2 overflow-x-auto rounded-md bg-surface-base p-3 font-mono text-code text-text-normal">
            {JSON.stringify(preview.examplePayload, null, 2)}
          </pre>
        </div>
        <div className="flex flex-col gap-3 text-body text-text-normal [&_code]:font-mono [&_code]:text-code [&_h1]:text-heading [&_h2]:text-subhead [&_h3]:text-subhead [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-base [&_pre]:p-3 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5">
          <Markdown remarkPlugins={[remarkGfm]}>{preview.markdown}</Markdown>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Preview"
      aria-busy={isFetching}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4"
    >
      <h2 className="text-subhead text-text-primary">Preview</h2>
      {waitingForJson && preview ? (
        <p className="text-body text-text-subtle">
          The JSON is incomplete. This is the last version that was valid.
        </p>
      ) : null}
      {body}
    </section>
  );
}
