'use client';

import Markdown from 'react-markdown';
import { Tabs } from 'radix-ui';
import remarkGfm from 'remark-gfm';

import type { SchemaPreviewDto } from '@/features/inbound-webhooks/types';
import { cn } from '@/shared/lib/utils';

interface PreviewPaneProps {
  preview: SchemaPreviewDto | undefined;
  /** The text is not valid JSON yet, so there is nothing to ask the API about. */
  waitingForJson: boolean;
  isFetching: boolean;
  className?: string;
}

const TAB_CLASS = cn(
  'rounded-md px-3 py-1.5 text-body text-text-muted transition-colors outline-none',
  'hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-border-focus',
  'data-[state=active]:bg-surface-active data-[state=active]:text-text-primary'
);

const DOCS_CLASS = cn(
  'flex flex-col gap-3 text-body text-text-normal',
  '[&_code]:font-mono [&_code]:text-code [&_h1]:text-heading [&_h2]:text-subhead [&_h3]:text-subhead',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-base [&_pre]:p-3',
  '[&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5'
);

function Message({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-text-subtle">{children}</p>;
}

/**
 * The example payload and the docs the schema would produce, as the API renders
 * them. A fixed height with its own scrolling, so a long schema never makes the
 * page longer; the docs sit behind a tab because they are the long part.
 */
export function PreviewPane({ preview, waitingForJson, isFetching, className }: PreviewPaneProps) {
  const stale = waitingForJson && preview;

  return (
    <section
      aria-label="Preview"
      aria-busy={isFetching}
      className={cn(
        'flex h-80 min-h-0 flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 xl:h-96',
        className
      )}
    >
      {!preview ? (
        <Message>
          {waitingForJson ? 'Fix the JSON to see the preview.' : 'Checking the schema…'}
        </Message>
      ) : !preview.ok ? (
        <Message>
          The schema has {preview.errors.length}{' '}
          {preview.errors.length === 1 ? 'problem' : 'problems'}. Fix{' '}
          {preview.errors.length === 1 ? 'it' : 'them'} to see the docs and an example payload.
        </Message>
      ) : (
        <Tabs.Root defaultValue="example" className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Tabs.List aria-label="Preview" className="flex gap-1">
              <Tabs.Trigger value="example" className={TAB_CLASS}>
                Example payload
              </Tabs.Trigger>
              <Tabs.Trigger value="docs" className={TAB_CLASS}>
                Docs
              </Tabs.Trigger>
            </Tabs.List>
            {stale ? (
              <span className="text-overline text-text-subtle">Last valid version</span>
            ) : null}
          </div>
          <Tabs.Content value="example" className="min-h-0 flex-1 overflow-auto outline-none">
            <pre className="rounded-md bg-surface-base p-3 font-mono text-code text-text-normal">
              {JSON.stringify(preview.examplePayload, null, 2)}
            </pre>
          </Tabs.Content>
          <Tabs.Content value="docs" className="min-h-0 flex-1 overflow-auto outline-none">
            <div className={DOCS_CLASS}>
              <Markdown remarkPlugins={[remarkGfm]}>{preview.markdown}</Markdown>
            </div>
          </Tabs.Content>
        </Tabs.Root>
      )}
    </section>
  );
}
