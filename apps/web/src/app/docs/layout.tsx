import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import '@/features/docs/docs.css';
import { DocsShell } from '@/features/docs/components/docs-shell';

export const metadata: Metadata = {
  title: { default: 'MCDI Docs', template: '%s | MCDI Docs' },
  description:
    'Developer documentation for MCDI, the MicroClub identity platform: how to use it from your project and how to work on it.',
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsShell>{children}</DocsShell>;
}
