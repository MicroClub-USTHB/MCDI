import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DocPageHeader } from '@/features/docs/components/doc-page-header';
import { DocPager } from '@/features/docs/components/doc-pager';
import { DocsOutline } from '@/features/docs/components/docs-outline';
import { extractHeadings } from '@/features/docs/headings';
import { allDocPages, findDoc } from '@/features/docs/nav';

/** Only the pages in the nav exist; anything else is a 404 without trying to render it. */
export const dynamicParams = false;

interface DocsPageProps {
  params: Promise<{ slug: string[] }>;
}

export function generateStaticParams() {
  return allDocPages().map((page) => ({ slug: page.slug.split('/') }));
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = findDoc(slug.join('/'));
  return page ? { title: page.title, description: page.description } : {};
}

export default async function DocsPage({ params }: DocsPageProps) {
  const slug = (await params).slug.join('/');
  if (!findDoc(slug)) notFound();

  const { default: Content } = await import(`@/content/docs/${slug}.mdx`);
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/content/docs', `${slug}.mdx`),
    'utf8'
  );

  return (
    <div className="grid gap-10 px-4 py-10 sm:px-8 xl:grid-cols-[minmax(0,1fr)_14rem]">
      <article id="doc-content" className="min-w-0 max-w-[70ch]">
        <DocPageHeader slug={slug} />
        <div className="docs-prose">
          <Content />
        </div>
        <DocPager slug={slug} />
      </article>
      <aside className="hidden xl:block">
        <DocsOutline headings={extractHeadings(source)} />
      </aside>
    </div>
  );
}
