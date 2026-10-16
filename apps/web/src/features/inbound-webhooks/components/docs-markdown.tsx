'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/shared/lib/utils';

const DOCS_CLASS = cn(
  'flex flex-col gap-3 paragraph-sm text-foreground',
  '[&_code]:font-mono [&_code]:text-xs [&_h1]:header-xs [&_h1]:font-bold [&_h2]:paragraph-sm [&_h2]:font-semibold [&_h3]:paragraph-sm [&_h3]:font-semibold',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3',
  '[&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5'
);

/** The API's generated docs, styled with the mcoli-ui tokens; raw HTML stays off. */
export function DocsMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className={DOCS_CLASS}>
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </div>
  );
}
