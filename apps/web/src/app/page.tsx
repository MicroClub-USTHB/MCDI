import type { Metadata } from 'next';

import { LandingHero } from '@/features/landing/components/landing-hero';
import { LandingNav } from '@/features/landing/components/landing-nav';
import { LANDING } from '@/features/landing/content';

export const metadata: Metadata = {
  title: { absolute: LANDING.metadata.title },
  description: LANDING.metadata.description,
};

export default function Home() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-surface-base text-text-primary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-body focus:text-on-brand"
      >
        Skip to main content
      </a>
      <LandingNav />
      <main id="main-content">
        <LandingHero />
      </main>
    </div>
  );
}
