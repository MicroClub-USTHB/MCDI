import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { LANDING } from '@/features/landing/content';
import { Button } from '@/shared/components/ui/button';

export function LandingHero() {
  return (
    <section className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 pt-8 pb-16 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:pt-0 lg:pb-12">
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-display text-text-primary motion-safe:animate-rise">
          {LANDING.headline}
        </h1>
        <p className="max-w-[52ch] text-lead text-text-muted motion-safe:animate-rise [animation-delay:90ms]">
          {LANDING.subtext}
        </p>
        <div className="flex flex-wrap gap-3 motion-safe:animate-rise [animation-delay:180ms]">
          <Button asChild>
            <Link href={LANDING.docs.href}>
              {LANDING.docs.label}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={LANDING.signIn.href}>{LANDING.signIn.label}</Link>
          </Button>
        </div>
      </div>

      {/* From lg the image runs on to the right edge of the screen, so the interface reads at a size you can read. */}
      <div className="relative lg:-mr-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-8 bg-[radial-gradient(60%_55%_at_60%_45%,var(--color-brand-tint),transparent)]"
        />
        <Image
          src={LANDING.screenshot.src}
          width={LANDING.screenshot.width}
          height={LANDING.screenshot.height}
          alt={LANDING.screenshot.alt}
          preload
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="relative h-auto w-full rounded-xl border border-border shadow-modal lg:rounded-r-none lg:border-r-0"
        />
      </div>
    </section>
  );
}
