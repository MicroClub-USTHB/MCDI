import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { allDocPages } from '@/features/docs/nav';

/**
 * Tests that keep the docs tied to the code they describe, so a page cannot quietly go stale:
 * every environment variable is documented, every excerpt is real, every cited file exists.
 */

const REPO = path.resolve(__dirname, '../../../../..');
const CONTENT_DIR = path.resolve(__dirname, '../../../src/content/docs');

const read = (file: string) => fs.readFileSync(path.join(REPO, file), 'utf8');
const doc = (slug: string) => fs.readFileSync(path.join(CONTENT_DIR, `${slug}.mdx`), 'utf8');

const pages = allDocPages().map((page) => ({ slug: page.slug, source: doc(page.slug) }));

function listTs(dir: string): string[] {
  return fs
    .readdirSync(path.join(REPO, dir), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listTs(`${dir}/${entry.name}`)
        : /\.ts$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)
          ? [`${dir}/${entry.name}`]
          : []
    );
}

describe('the environment variables on the local setup page', () => {
  const page = doc('build/local-setup');
  const documented = (name: string) => page.includes(`\`${name}\``);

  const fromConfigModule = [
    ...read('apps/api/src/config/config.module.ts').matchAll(/^\s{8}([A-Z][A-Z0-9_]+):\s*Joi/gm),
  ].map((m) => m[1]!);
  const fromConfigFiles = [
    ...new Set(
      fs
        .readdirSync(path.join(REPO, 'apps/api/src/config'))
        .filter((file) => /\.config\.ts$/.test(file))
        .flatMap((file) =>
          [...read(`apps/api/src/config/${file}`).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)].map(
            (m) => m[1]!
          )
        )
    ),
  ];
  const fromEnvExample = [
    ...new Set(
      [...read('apps/api/.env.example').matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]!)
    ),
  ];
  const fromWeb = [
    ...read('apps/web/src/shared/lib/env.ts').matchAll(/^\s{2}([A-Z][A-Z0-9_]+):\s*z\./gm),
  ].map((m) => m[1]!);

  it('finds the variables it checks, so the patterns above cannot silently match nothing', () => {
    expect(fromConfigModule.length).toBeGreaterThan(10);
    expect(fromConfigFiles.length).toBeGreaterThan(25);
    expect(fromEnvExample.length).toBeGreaterThan(30);
    expect(fromWeb).toEqual(['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_APP_URL', 'NODE_ENV']);
  });

  it.each([
    ['config.module.ts', fromConfigModule],
    ['the config files', fromConfigFiles],
    ['.env.example', fromEnvExample],
    ['the web env schema', fromWeb],
  ])('documents every variable in %s', (_name, names) => {
    expect(names.filter((name) => !documented(name))).toEqual([]);
  });

  it('documents every variable the API reads through the config service', () => {
    const reads = new Set(
      listTs('apps/api/src').flatMap((file) =>
        [
          ...read(file).matchAll(
            /\b(?:configService|config)\s*\.get<[^>]+>\(\s*'([A-Z][A-Z0-9_]+)'/g
          ),
        ].map((m) => m[1]!)
      )
    );

    expect(reads.size).toBeGreaterThanOrEqual(4);
    expect([...reads].filter((name) => !documented(name))).toEqual([]);
  });
});

describe('code excerpts in the docs', () => {
  const found = pages.flatMap(({ slug, source }) =>
    [...source.matchAll(/\{\/\* excerpt: (\S+) \*\/\}\s*\n\s*```(\w*)\n([\s\S]*?)\n```/g)].map(
      (m) => ({
        slug,
        file: m[1]!,
        body: m[3]!,
      })
    )
  );

  it('are present on the API guide', () => {
    expect(
      found.filter((excerpt) => excerpt.slug === 'build/api-guide').length
    ).toBeGreaterThanOrEqual(8);
  });

  it.each(
    found.map(
      (excerpt, index) => [`${excerpt.slug} #${index + 1} (${excerpt.file})`, excerpt] as const
    )
  )('%s matches its source file', (_label, excerpt) => {
    const sourceLines = read(excerpt.file)
      .split('\n')
      .map((line) => line.trim());
    let cursor = 0;
    const missing: string[] = [];

    for (const raw of excerpt.body.split('\n')) {
      const line = raw.trim();
      if (line === '' || ['// ...', '-- ...', '/* ... */'].includes(line)) continue;
      const at = sourceLines.indexOf(line, cursor);
      if (at === -1) {
        missing.push(line);
        continue;
      }
      cursor = at + 1;
    }

    expect(missing, 'lines that are not in the file, in order').toEqual([]);
  });
});

describe('the files a page cites', () => {
  // Tracked by git, not merely present: a file that is ignored (a personal override) exists
  // on one machine and not in a fresh clone or in CI, which is where a reader would look.
  const tracked = new Set(
    execFileSync('git', ['ls-files'], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 })
      .toString()
      .split('\n')
  );
  const isTracked = (file: string) =>
    tracked.has(file) || [...tracked].some((candidate) => candidate.startsWith(`${file}/`));

  it.each(pages.map(({ slug, source }) => [slug, source] as const))(
    '%s cites files that are in the repository',
    (_slug, source) => {
      const line = source
        .split('\n')
        .reverse()
        .find((l) => l.startsWith('Source:'))!;
      const cited = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);

      expect(cited.length).toBeGreaterThan(0);
      expect(cited.filter((file) => !isTracked(file))).toEqual([]);
    }
  );
});
