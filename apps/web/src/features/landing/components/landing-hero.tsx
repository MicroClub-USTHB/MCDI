import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { LANDING } from '@/features/landing/content';
import { buttonVariants } from '@/shared/components/ui/mc-button';
import { cn } from '@/shared/lib/utils';

export function LandingHero() {
  return (
    <section className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-4 pt-8 pb-16 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:pt-0 lg:pb-12">
      <div className="flex flex-col items-start gap-6">
        <h1 className="header-lg font-extrabold text-balance text-foreground motion-safe:animate-rise sm:header-xl">
          {LANDING.headline}
        </h1>
        <p className="max-w-[52ch] paragraph-lg text-muted-foreground motion-safe:animate-rise [animation-delay:90ms]">
          {LANDING.subtext}
        </p>
        <div className="flex flex-wrap gap-3 motion-safe:animate-rise [animation-delay:180ms]">
          <Link
            href={LANDING.docs.href}
            className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'gap-2')}
          >
            {LANDING.docs.label}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={LANDING.signIn.href}
            className={buttonVariants({ variant: 'secondary', size: 'lg' })}
          >
            {LANDING.signIn.label}
          </Link>
        </div>
      </div>

      {/* From lg the image runs on to the right edge of the screen, so the interface reads at a size you can read. */}
      <div className="relative lg:-mr-[max(2rem,calc((100vw-80rem)/2+2rem))]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-8 bg-[radial-gradient(55%_50%_at_65%_40%,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_70%),radial-gradient(45%_45%_at_25%_75%,color-mix(in_srgb,var(--color-purple-secondary-500)_22%,transparent),transparent_70%)]"
        />
        <Image
          src={LANDING.screenshot.src}
          width={LANDING.screenshot.width}
          height={LANDING.screenshot.height}
          alt={LANDING.screenshot.alt}
          preload
          sizes="(min-width: 1024px) 58vw, 100vw"
          className="relative h-auto w-full rounded-xl border border-border shadow-xl lg:rounded-r-none lg:border-r-0"
        />
      </div>
    </section>
  );
}
