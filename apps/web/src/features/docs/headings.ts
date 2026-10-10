import GithubSlugger from 'github-slugger';

export interface DocHeadingInfo {
  id: string;
  text: string;
  level: 2 | 3 | 4;
}

/** The text a reader sees: links keep their label, inline code and emphasis lose their marks. */
function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .trim();
}

/**
 * The h2 to h4 headings of an MDX source with the ids `rehype-slug` gives them (the same slugger,
 * counting repeats in the same order), found without compiling the page. Code blocks are skipped,
 * so a comment such as `## install` inside one is not mistaken for a heading.
 */
export function extractHeadings(source: string): DocHeadingInfo[] {
  const slugger = new GithubSlugger();
  const headings: DocHeadingInfo[] = [];
  let inFence = false;

  for (const line of source.split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = line.match(/^(#{2,4})\s+(.*?)\s*#*\s*$/);
    if (!match) continue;
    const text = plainText(match[2] ?? '');
    headings.push({ id: slugger.slug(text), text, level: (match[1] ?? '').length as 2 | 3 | 4 });
  }
  return headings;
}
