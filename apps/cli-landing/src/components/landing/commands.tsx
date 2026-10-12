import { Container, CopyButton, Reveal, SectionHeading } from '@/components/landing/primitives';
import {
  McAccordion,
  McAccordionContent,
  McAccordionItem,
  McAccordionTrigger,
} from '@/components/ui/mc-accordion';
import { McBadge } from '@/components/ui/mc-badge';
import { McCard, McCardContent, McCardHeader } from '@/components/ui/mc-card';

// The implemented commands, with the descriptions the CLI itself prints in --help.
const GROUPS = [
  {
    id: 'auth',
    name: 'Auth',
    commands: [
      {
        usage: 'm-forge login --profile <name>',
        description: 'Authenticate against MCDI via browser-based Discord OAuth',
      },
      {
        usage: 'm-forge whoami --profile <name>',
        description: "Print the authenticated admin's identity",
      },
      {
        usage: 'm-forge logout --profile <name>',
        description: 'Invalidate the current session and forget it locally',
      },
    ],
  },
  {
    id: 'profiles',
    name: 'Profiles & config',
    commands: [
      { usage: 'm-forge profile list', description: 'List configured profiles' },
      { usage: 'm-forge profile add <name> --base-url <url>', description: 'Add a new profile' },
      { usage: 'm-forge profile use <name>', description: 'Set the active profile' },
      { usage: 'm-forge config show', description: 'Print a profile with secrets redacted' },
    ],
  },
  {
    id: 'schema',
    name: 'Schema',
    commands: [
      {
        usage: 'm-forge schema init [path]',
        description: 'Scaffold a starter FormSchema JSON file',
      },
      {
        usage: 'm-forge schema validate <path>',
        description: 'Run the local pre-check only, no network call',
      },
    ],
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    commands: [
      { usage: 'm-forge webhook list --profile <name>', description: 'List webhooks' },
      { usage: 'm-forge webhook get <id> --profile <name>', description: 'Inspect one webhook' },
      {
        usage: 'm-forge webhook update <id> --profile <name>',
        description: 'Update an existing webhook',
      },
      {
        usage: 'm-forge webhook delete <id> --profile <name>',
        description: 'Delete a webhook and all its submissions',
      },
    ],
  },
  {
    id: 'access',
    name: 'Access & secrets',
    commands: [
      {
        usage: 'm-forge webhook roles set <id> --roles <ids> --profile <name>',
        description: 'Replace the allowed-reader role list',
      },
      {
        usage: 'm-forge webhook rotate-secret <id> --profile <name>',
        description: "Rotate a webhook's signing secret",
      },
      {
        usage: 'm-forge webhook secret get --profile <name>',
        description: 'Retrieve a stored signing secret',
      },
    ],
  },
];

const EXIT_CODES = [
  { code: 0, meaning: 'OK' },
  { code: 1, meaning: 'Pre-check failed' },
  { code: 2, meaning: 'Rejected by MCDI' },
  { code: 3, meaning: 'Auth required' },
  { code: 4, meaning: 'Not found' },
  { code: 5, meaning: 'Unexpected error' },
];

export function Commands() {
  return (
    <section
      id="commands"
      aria-labelledby="commands-title"
      className="scroll-mt-16 border-t border-border py-16 sm:py-24"
    >
      <Container>
        <SectionHeading
          id="commands-title"
          eyebrow="Commands"
          title="Command reference"
          description="Every state-changing command takes an explicit --profile, so scripts and CI never rely on hidden state."
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Reveal>
            <McCard className="gap-0 px-6 py-2">
              <McAccordion defaultValue={['auth']} className="w-full">
                {GROUPS.map((group) => (
                  <McAccordionItem key={group.id} value={group.id}>
                    <McAccordionTrigger>
                      <span className="flex items-center gap-2">
                        {group.name}
                        <McBadge variant="outline" size="sm" className="min-w-0">
                          {group.commands.length}
                        </McBadge>
                      </span>
                    </McAccordionTrigger>
                    <McAccordionContent>
                      <ul className="divide-y divide-border">
                        {group.commands.map((command) => (
                          <li key={command.usage} className="flex items-start gap-3 py-3">
                            <div className="min-w-0 flex-1">
                              <code className="block font-mono paragraph-sm break-words text-foreground">
                                {command.usage}
                              </code>
                              <p className="mt-0.5 paragraph-xs text-muted-foreground">
                                {command.description}
                              </p>
                            </div>
                            <CopyButton value={command.usage} />
                          </li>
                        ))}
                      </ul>
                    </McAccordionContent>
                  </McAccordionItem>
                ))}
              </McAccordion>
            </McCard>
          </Reveal>

          <Reveal delay={100}>
            <McCard className="p-6">
              <McCardHeader title="Exit codes" description="What a script can branch on." />
              <McCardContent>
                <ul className="flex flex-col gap-3">
                  {EXIT_CODES.map(({ code, meaning }) => (
                    <li key={code} className="flex items-center gap-3">
                      <McBadge
                        variant={code === 0 ? 'secondary' : 'outline'}
                        size="sm"
                        className="min-w-8 font-mono"
                      >
                        {code}
                      </McBadge>
                      <span className="paragraph-sm text-foreground">{meaning}</span>
                    </li>
                  ))}
                </ul>
              </McCardContent>
            </McCard>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
