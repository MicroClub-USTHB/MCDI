'use client';

import { DocsMarkdown } from '@/features/inbound-webhooks/components/docs-markdown';
import type { SchemaPreviewDto } from '@/features/inbound-webhooks/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { cn } from '@/shared/lib/utils';

interface PreviewPaneProps {
  preview: SchemaPreviewDto | undefined;
  /** The text is not valid JSON yet, so there is nothing to ask the API about. */
  waitingForJson: boolean;
  isFetching: boolean;
  className?: string;
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="paragraph-sm text-muted-foreground">{children}</p>;
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
        'flex h-80 min-h-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 xl:h-96',
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
        <Tabs defaultValue="example" className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <TabsList aria-label="Preview">
              <TabsTrigger value="example">Example payload</TabsTrigger>
              <TabsTrigger value="docs">Docs</TabsTrigger>
            </TabsList>
            {stale ? (
              <span className="paragraph-xs font-semibold tracking-wide text-muted-foreground">
                Last valid version
              </span>
            ) : null}
          </div>
          <TabsContent value="example" className="min-h-0 flex-1 overflow-auto">
            <pre className="rounded-md bg-background p-3 font-mono text-xs text-foreground">
              {JSON.stringify(preview.examplePayload, null, 2)}
            </pre>
          </TabsContent>
          <TabsContent value="docs" className="min-h-0 flex-1 overflow-auto">
            <DocsMarkdown markdown={preview.markdown} />
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
}
