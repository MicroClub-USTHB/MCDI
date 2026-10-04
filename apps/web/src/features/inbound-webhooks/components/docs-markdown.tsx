'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { cn } from '@/shared/lib/utils';

const DOCS_CLASS = cn(
  'flex flex-col gap-3 text-body text-text-normal',
  '[&_code]:font-mono [&_code]:text-code [&_h1]:text-heading [&_h2]:text-subhead [&_h3]:text-subhead',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-base [&_pre]:p-3',
  '[&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
  '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5'
);

/** The API's generated docs, styled with the panel's tokens; raw HTML stays off. */
export function DocsMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className={DOCS_CLASS}>
      <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </div>
  );
}
