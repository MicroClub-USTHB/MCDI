import type { MetadataRoute } from 'next';

import { allDocPages } from '@/features/docs/nav';
import { env } from '@/shared/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  return [
    { url: `${base}/` },
    { url: `${base}/docs` },
    ...allDocPages().map((page) => ({ url: `${base}/docs/${page.slug}` })),
  ];
}
