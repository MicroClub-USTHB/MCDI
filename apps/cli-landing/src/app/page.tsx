import { Commands } from '@/components/landing/commands';
import { Features } from '@/components/landing/features';
import { FinalCta } from '@/components/landing/final-cta';
import { Hero } from '@/components/landing/hero';
import { Quickstart } from '@/components/landing/quickstart';

export default function Home() {
  return (
    <>
      <Hero />
      <Quickstart />
      <Features />
      <Commands />
      <FinalCta />
    </>
  );
}
