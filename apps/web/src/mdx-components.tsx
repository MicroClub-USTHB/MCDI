import type { ComponentProps } from 'react';
import type { MDXComponents } from 'mdx/types';

import { Callout } from '@/features/docs/components/callout';
import { CodeBlock } from '@/features/docs/components/code-block';
import { Diagram } from '@/features/docs/components/diagram';
import { DocHeading } from '@/features/docs/components/doc-heading';
import { DocLink } from '@/features/docs/components/doc-link';
import { DocTable } from '@/features/docs/components/doc-table';
import { Endpoint } from '@/features/docs/components/endpoint';
import { InboundContract } from '@/features/docs/components/inbound-contract';
import { Steps } from '@/features/docs/components/steps';
import { SwaggerLink } from '@/features/docs/components/swagger-link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

/** Inline code only: a block's code carries the highlighter's `language-` class. */
function InlineCode({ className, ...props }: ComponentProps<'code'>) {
  if (className) return <code className={className} {...props} />;
  return (
    <code
      className="rounded-sm bg-surface-active px-1.5 py-0.5 font-mono text-code text-text-primary [overflow-wrap:anywhere]"
      {...props}
    />
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => <DocHeading level={2} {...props} />,
    h3: (props) => <DocHeading level={3} {...props} />,
    h4: (props) => <DocHeading level={4} {...props} />,
    a: DocLink,
    pre: CodeBlock,
    code: InlineCode,
    table: DocTable,
    Callout,
    Steps,
    Diagram,
    Endpoint,
    SwaggerLink,
    InboundContract,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    ...components,
  };
}
