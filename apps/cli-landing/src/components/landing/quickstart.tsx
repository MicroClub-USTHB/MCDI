'use client';

import * as React from 'react';

import { CommandBlock, Container, Reveal, SectionHeading } from '@/components/landing/primitives';
import { McButton } from '@/components/ui/mc-button';
import { McCard, McCardContent, McCardFooter, McCardHeader } from '@/components/ui/mc-card';
import { McTabs, McTabsList, McTabsPanel, McTabsTrigger } from '@/components/ui/mc-tabs';

interface Step {
  id: string;
  tab: string;
  title: string;
  description: string;
  command: string;
  // What m-forge actually prints for this command (see src/ in the CLI).
  output: string;
}

const STEPS: Step[] = [
  {
    id: 'login',
    tab: 'Log in',
    title: 'Log in to MCDI',
    description:
      'Opens Discord OAuth in your browser. The first login on a profile also needs the MCDI URL; after that, --profile is enough.',
    command: 'm-forge login --profile prod --base-url https://mcdi.example.com',
    output: 'Waiting for the login to complete...\nLogged in as mcdi-admin on prod',
  },
  {
    id: 'scaffold',
    tab: 'Scaffold',
    title: 'Scaffold a schema',
    description: 'Start from the minimal or the recruitment template instead of a blank file.',
    command: 'm-forge schema init form.json --template recruitment',
    output: 'Created form.json',
  },
  {
    id: 'validate',
    tab: 'Validate',
    title: 'Pre-check it offline',
    description: 'Runs MCDI’s schema rules plus house rules locally. No network call.',
    command: 'm-forge schema validate form.json',
    output: '✓ Schema is valid (source: local)',
  },
  {
    id: 'create',
    tab: 'Create',
    title: 'Create the webhook',
    description:
      'MCDI validates the schema again and returns a signing secret. m-forge stores it encrypted and prints it masked.',
    // Shell line continuations keep it readable and still paste as one command.
    command:
      'm-forge webhook create form.json \\\n  --name "Club recruitment" --project $PROJECT_ID \\\n  --roles $ROLE_ID --profile prod',
    output: 'Created Club recruitment (club-recruitment) on prod\nSigning secret: ********9f2c',
  },
];

export function Quickstart() {
  const [value, setValue] = React.useState(STEPS[0]!.id);

  return (
    <section
      id="quickstart"
      aria-labelledby="quickstart-title"
      className="scroll-mt-16 border-t border-border py-16 sm:py-24"
    >
      <Container>
        <SectionHeading
          id="quickstart-title"
          eyebrow="Quickstart"
          title="From zero to a live webhook in four commands"
          description="Pick a step to see its command and what m-forge prints back."
        />

        <Reveal>
          <McTabs value={value} onValueChange={(v) => setValue(v as string)}>
            <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              <McTabsList aria-label="Quickstart steps">
                {STEPS.map((s, i) => (
                  <McTabsTrigger key={s.id} value={s.id}>
                    {i + 1}. {s.tab}
                  </McTabsTrigger>
                ))}
              </McTabsList>
            </div>

            {STEPS.map((s, i) => {
              const next = STEPS[i + 1];
              return (
                <McTabsPanel key={s.id} value={s.id} className="mt-4 rounded-lg">
                  <McCard className="gap-5 p-6">
                    <McCardHeader title={`${i + 1}. ${s.title}`} description={s.description} />
                    <McCardContent className="grid gap-4">
                      <div className="min-w-0">
                        <p className="mb-2 paragraph-xs font-medium text-muted-foreground">Run</p>
                        <CommandBlock command={s.command} />
                      </div>
                      <div className="min-w-0">
                        <p className="mb-2 paragraph-xs font-medium text-muted-foreground">
                          Output
                        </p>
                        <pre className="rounded-lg border border-border px-4 py-3 font-mono paragraph-sm break-words whitespace-pre-wrap text-muted-foreground">
                          {s.output}
                        </pre>
                      </div>
                    </McCardContent>
                    {next ? (
                      <McCardFooter align="end">
                        <McButton variant="secondary" size="sm" onClick={() => setValue(next.id)}>
                          Next: {next.tab}
                        </McButton>
                      </McCardFooter>
                    ) : null}
                  </McCard>
                </McTabsPanel>
              );
            })}
          </McTabs>
        </Reveal>
      </Container>
    </section>
  );
}
