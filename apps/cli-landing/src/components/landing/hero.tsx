import { ArrowRight } from 'lucide-react';

import { CommandBlock, Container, GithubIcon } from '@/components/landing/primitives';
import { McBadge } from '@/components/ui/mc-badge';
import { McButton } from '@/components/ui/mc-button';
import { McCard } from '@/components/ui/mc-card';
import { INSTALL_COMMAND, REPO_URL } from '@/lib/site';

// Real m-forge output for a schema with two mistakes, then the same schema fixed.
function TerminalPreview() {
  return (
    <McCard className="gap-0 overflow-hidden p-0 shadow-md">
      <div
        className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2.5"
        aria-hidden
      >
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="size-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ms-2 font-mono text-xs text-muted-foreground">terminal</span>
      </div>
      <pre className="p-5 font-mono paragraph-sm break-words whitespace-pre-wrap text-foreground">
        <span className="text-muted-foreground">$</span> m-forge schema validate form.json{'\n'}
        <span className="text-destructive dark:text-red-100">
          ✗ 2 validation errors (source: local)
        </span>
        {'\n'}
        <span className="text-muted-foreground">
          {'  version  UNSUPPORTED_VERSION  Only version 1 is supported\n'}
        </span>
        <span className="text-muted-foreground">
          {'  steps  NO_STEPS  Schema must declare at least one step\n'}
        </span>
        {'\n'}
        <span className="text-muted-foreground">$</span> m-forge schema validate form.json{'\n'}
        <span className="text-success">✓ Schema is valid (source: local)</span>
      </pre>
    </McCard>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="py-16 sm:py-24">
      <Container className="grid items-center gap-12 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* No fade here: the first screen must show without waiting for JavaScript. */}
        <div className="flex flex-col items-start gap-6">
          <McBadge variant="default" size="md">
            For MCDI system admins
          </McBadge>
          <h1 id="hero-title" className="header-md font-bold text-foreground sm:header-lg">
            Create your own backend schema.
          </h1>
          <p className="max-w-xl paragraph-lg text-muted-foreground">
            Log in once, pre-check your form schemas offline, then create and manage MCDI webhooks
            without hand-writing JSON or raw HTTP calls.
          </p>
          <div className="flex flex-wrap gap-3">
            <McButton
              nativeButton={false}
              size="lg"
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
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <TerminalPreview />
          <div>
            <p className="mb-2 paragraph-xs font-medium text-muted-foreground">
              Install from source
            </p>
            <CommandBlock command={INSTALL_COMMAND} />
          </div>
        </div>
      </Container>
    </section>
  );
}
