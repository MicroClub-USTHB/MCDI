import { ArrowRight } from 'lucide-react';

import { Container, GithubIcon, Reveal } from '@/components/landing/primitives';
import { McButton } from '@/components/ui/mc-button';
import { McCard } from '@/components/ui/mc-card';
import { REPO_URL } from '@/lib/site';

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="pb-16 sm:pb-24">
      <Container>
        <Reveal>
          <McCard className="items-center gap-6 border-none bg-primary p-10 text-center text-primary-foreground sm:p-14">
            <h2 id="cta-title" className="header-xs font-bold sm:header-sm">
              Ready to forge your first webhook?
            </h2>
            <p className="max-w-lg paragraph-md opacity-80">
              Clone the repo, build the CLI and log in to your MCDI instance.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <McButton
                nativeButton={false}
                size="lg"
                variant="tertiary"
                icon="trailing"
                iconDefinition={<ArrowRight />}
                render={<a href="#quickstart" />}
              >
                Get started
              </McButton>
              <McButton
                nativeButton={false}
                size="lg"
                variant="secondary"
                icon="leading"
                iconDefinition={<GithubIcon />}
                render={<a href={REPO_URL} target="_blank" rel="noopener noreferrer" />}
              >
                View on GitHub
              </McButton>
            </div>
          </McCard>
        </Reveal>
      </Container>
    </section>
  );
}
