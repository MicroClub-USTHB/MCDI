import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Callout } from '@/features/docs/components/callout';
import { CodeBlock } from '@/features/docs/components/code-block';
import { Diagram } from '@/features/docs/components/diagram';
import { DocHeading } from '@/features/docs/components/doc-heading';
import { DocLink } from '@/features/docs/components/doc-link';
import { DocTable } from '@/features/docs/components/doc-table';
import { Steps } from '@/features/docs/components/steps';

describe('Callout', () => {
  it.each([
    ['note', 'Note'],
    ['tip', 'Tip'],
    ['warning', 'Warning'],
  ] as const)('labels a %s in words, so the meaning does not rest on colour', (type, label) => {
    render(<Callout type={type}>Mind the gap.</Callout>);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(label);
    expect(note).toHaveTextContent('Mind the gap.');
  });

  it('is a note by default', () => {
    render(<Callout>Plain.</Callout>);

    expect(screen.getByRole('note')).toHaveTextContent('Note');
  });
});

describe('Steps', () => {
  it('keeps the numbered list it wraps', () => {
    render(
      <Steps>
        <ol>
          <li>First</li>
          <li>Second</li>
        </ol>
      </Steps>
    );

    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'First',
      'Second',
    ]);
  });
});

describe('CodeBlock', () => {
  afterEach(() => vi.restoreAllMocks());

  function block() {
    return (
      <CodeBlock>
        <code className="hljs language-bash">pnpm install</code>
      </CodeBlock>
    );
  }

  it('names the language it was written in', () => {
    render(block());

    expect(screen.getByText('bash')).toBeInTheDocument();
  });

  it('copies exactly the code and says it did', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(block());

    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(writeText).toHaveBeenCalledWith('pnpm install');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
  });

  it('stays quiet when the browser refuses the clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    render(block());

    await userEvent.click(screen.getByRole('button', { name: 'Copy code' }));

    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('works without a language too', () => {
    render(
      <CodeBlock>
        <code>plain</code>
      </CodeBlock>
    );

    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });
});

describe('DocHeading', () => {
  it('gives the heading a link to itself', () => {
    render(
      <DocHeading level={2} id="local-setup">
        Local setup
      </DocHeading>
    );

    expect(screen.getByRole('heading', { level: 2, name: /Local setup/ })).toHaveAttribute(
      'id',
      'local-setup'
    );
    expect(screen.getByRole('link', { name: 'Link to Local setup' })).toHaveAttribute(
      'href',
      '#local-setup'
    );
  });

  it('is a plain heading when it has no id', () => {
    render(<DocHeading level={3}>Loose</DocHeading>);

    expect(screen.getByRole('heading', { level: 3, name: 'Loose' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('DocLink', () => {
  it('opens a docs link in the same tab', () => {
    render(<DocLink href="/docs/build/contributing">Contributing</DocLink>);

    const link = screen.getByRole('link', { name: 'Contributing' });
    expect(link).toHaveAttribute('href', '/docs/build/contributing');
    expect(link).not.toHaveAttribute('target');
  });

  it('keeps an in-page anchor in the page', () => {
    render(<DocLink href="#steps">Steps</DocLink>);

    expect(screen.getByRole('link', { name: 'Steps' })).toHaveAttribute('href', '#steps');
  });

  it('opens an outside link in a new tab without handing over the opener', () => {
    render(<DocLink href="https://discord.com/developers">Discord</DocLink>);

    const link = screen.getByRole('link', { name: /Discord/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

describe('DocTable', () => {
  it('lets a wide table scroll inside its own box', () => {
    render(
      <DocTable>
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>x</td>
          </tr>
        </tbody>
      </DocTable>
    );

    expect(screen.getByRole('table').parentElement).toHaveClass('overflow-x-auto');
  });
});

describe('Diagram', () => {
  it('shows the image with its description', () => {
    render(<Diagram src="/docs/x.svg" alt="Projects call the API." width={400} height={200} />);

    const image = screen.getByRole('img', { name: 'Projects call the API.' });
    expect(image.getAttribute('src')).toContain('x.svg');
  });
});
