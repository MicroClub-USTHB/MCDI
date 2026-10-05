import type { NextConfig } from 'next';
import createMDX from '@next/mdx';

const withMDX = createMDX({
  options: {
    // Turbopack takes plugins by name only, with options that can be serialised.
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: ['rehype-slug', ['rehype-highlight', { detect: false, ignoreMissing: true }]],
  },
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default withMDX(nextConfig);
