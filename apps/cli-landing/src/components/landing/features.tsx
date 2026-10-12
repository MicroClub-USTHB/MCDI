import { FileCheck2, KeyRound, LockKeyhole, Webhook } from 'lucide-react';

import { Container, Reveal, SectionHeading } from '@/components/landing/primitives';
import { McAlert } from '@/components/ui/mc-alert';
import { McCard, McCardContent, McCardHeader } from '@/components/ui/mc-card';

const FEATURES = [
  {
    icon: KeyRound,
    title: 'Log in once',
    description:
      'Browser-based Discord OAuth against MCDI. The session token is stored encrypted in the OS keychain, never in plain text.',
  },
  {
    icon: FileCheck2,
    title: 'Validate offline',
    description:
      'The local pre-check mirrors MCDI’s schema rules plus house rules, so mistakes show up before any request is sent.',
  },
  {
    icon: Webhook,
    title: 'Manage webhooks',
    description:
      'Create, list, inspect, update and delete backends, and choose which Discord roles can read submissions.',
  },
  {
    icon: LockKeyhole,
    title: 'Keep secrets safe',
    description:
      'MCDI never re-issues a signing secret, so m-forge keeps the only copy: encrypted at rest and masked on screen.',
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-16 border-t border-border bg-muted/40 py-16 sm:py-24"
    >
      <Container>
        <SectionHeading
          id="features-title"
          eyebrow="Features"
          title="Everything an admin needs, nothing more"
          description="m-forge is a thin client in front of the MCDI API."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <Reveal key={title} delay={i * 60} className="flex">
              <McCard className="p-6 transition-shadow duration-200 hover:shadow-md">
                <span className="inline-flex size-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="size-5" aria-hidden />
                </span>
                <McCardHeader title={title} />
                <McCardContent className="paragraph-sm text-muted-foreground">
                  {description}
                </McCardContent>
              </McCard>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6">
          <McAlert
            variant="default"
            className="w-full max-w-none bg-background"
            title="MCDI stays the final authority"
            description="The local pre-check can only be stricter than MCDI, never looser. MCDI validates every schema again when you create or update a webhook."
          />
        </Reveal>
      </Container>
    </section>
  );
}
