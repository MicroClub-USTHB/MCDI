import { describe, expect, it } from 'vitest';

import { extractHeadings } from '@/features/docs/headings';

describe('extractHeadings', () => {
  it('lists the h2 to h4 headings with the ids rehype-slug will give them', () => {
    const source = '## Local setup\n\ntext\n\n### Docker\n\n#### Ports\n';

    expect(extractHeadings(source)).toEqual([
      { id: 'local-setup', text: 'Local setup', level: 2 },
      { id: 'docker', text: 'Docker', level: 3 },
      { id: 'ports', text: 'Ports', level: 4 },
    ]);
  });

  it('ignores the h1, which is the nav title and not part of the content', () => {
    expect(extractHeadings('# Title\n\n## Real\n')).toEqual([
      { id: 'real', text: 'Real', level: 2 },
    ]);
  });

  it('does not read comments inside code blocks as headings', () => {
    const source = '## Real\n\n```bash\n## not a heading\n```\n\n## After\n';

    expect(extractHeadings(source).map((heading) => heading.text)).toEqual(['Real', 'After']);
  });

  it('numbers repeated headings the way the slugger does', () => {
    expect(extractHeadings('## Notes\n\n## Notes\n').map((heading) => heading.id)).toEqual([
      'notes',
      'notes-1',
    ]);
  });

  it('drops inline formatting from the text and the id', () => {
    expect(extractHeadings('## Use `pnpm` **now**\n')).toEqual([
      { id: 'use-pnpm-now', text: 'Use pnpm now', level: 2 },
    ]);
  });

  it('copes with a page that has no headings', () => {
    expect(extractHeadings('just text\n')).toEqual([]);
  });
});
