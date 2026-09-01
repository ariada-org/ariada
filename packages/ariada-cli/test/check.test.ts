// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXIT_OK, EXIT_INVALID_ARGS, EXIT_VIOLATIONS } from '../src/exit-codes.js';
import { findConfig, findingLine, runCheck, serveDirectory, waitForPage } from '../src/subcommands/check.js';

/** A project on disk: a config, a built directory, and a page in it. */
async function project(config: unknown, pages: Record<string, string> = { 'index.html': '<html lang="en"><title>Hi</title><body><main>Hi</main></body></html>' }) {
  const dir = await mkdtemp(join(tmpdir(), 'ariada-check-'));
  await writeFile(join(dir, 'ariada.json'), JSON.stringify(config), 'utf8');
  for (const [name, body] of Object.entries(pages)) {
    const full = join(dir, 'built', name);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, body, 'utf8');
  }
  return dir;
}

function collect() {
  const chunks: string[] = [];
  return {
    stream: { write: (s: string) => (chunks.push(s), true) } as unknown as NodeJS.WritableStream,
    get text() {
      return chunks.join('');
    },
  };
}

describe('serving the built site', () => {
  it('takes a port the system hands out, so it cannot land on someone else', async () => {
    const dir = await project({ root: 'built' });
    const { server, origin } = await serveDirectory(join(dir, 'built'));
    expect(origin).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    // Not the number the first version hardcoded, except by coincidence.
    const page = await waitForPage(`${origin}/index.html`);
    expect(await page.text()).toContain('<main>');
    server.close();
  });

  it('refuses a path that climbs out of the site', async () => {
    const dir = await project({ root: 'built' });
    await writeFile(join(dir, 'secret.txt'), 'not for the web', 'utf8');
    const { server, origin } = await serveDirectory(join(dir, 'built'));
    const response = await fetch(`${origin}/../secret.txt`);
    expect(await response.text()).not.toContain('not for the web');
    server.close();
  });

  it('serves a directory as its index', async () => {
    const dir = await project({ root: 'built' }, { 'en/index.html': '<html lang="en"><body>x</body></html>' });
    const { server, origin } = await serveDirectory(join(dir, 'built'));
    expect((await waitForPage(`${origin}/en/`)).status).toBe(200);
    server.close();
  });
});

describe('finding the project configuration', () => {
  it('looks upward, so the command works from a subdirectory', async () => {
    const dir = await project({ root: 'built' });
    await mkdir(join(dir, 'built', 'deep'), { recursive: true });
    expect(await findConfig(join(dir, 'built', 'deep'), ['ariada.json'])).toBe(join(dir, 'ariada.json'));
  });

  it('returns nothing rather than inventing a project', async () => {
    expect(await findConfig('/', ['ariada-nothing-is-called-this.json'])).toBeUndefined();
  });
});

describe('checking a project', () => {
  it('scans the pages the project declares, at the address it is served from', async () => {
    const dir = await project({ root: 'built', pages: ['index.html', 'en/index.html'] }, {
      'index.html': '<html lang="en"><body>a</body></html>',
      'en/index.html': '<html lang="en"><body>b</body></html>',
    });
    let seen: readonly string[] = [];
    let options: Record<string, unknown> = {};
    const code = await runCheck({ cwd: dir }, collect().stream, collect().stream, {
      scan: async (urls, opts) => ((seen = urls), (options = opts), EXIT_OK),
    });
    expect(code).toBe(EXIT_OK);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/index\.html$/);
    expect(seen[1]).toMatch(/\/en\/index\.html$/);
    expect(options['outputDir']).toBe(join(dir, 'ariada-report'));
    expect(options['allowPrivate']).toBe(true);
  });

  it('does not fail the build when the page has problems', async () => {
    const dir = await project({ root: 'built' });
    const code = await runCheck({ cwd: dir }, collect().stream, collect().stream, {
      scan: async () => EXIT_VIOLATIONS,
    });
    expect(code).toBe(EXIT_OK);
  });

  it('passes the verdict through when the project asks it to', async () => {
    const dir = await project({ root: 'built' });
    const code = await runCheck({ cwd: dir, strict: true }, collect().stream, collect().stream, {
      scan: async () => EXIT_VIOLATIONS,
    });
    expect(code).toBe(EXIT_VIOLATIONS);
  });

  it('says what to do when there is no configuration', async () => {
    const err = collect();
    const dir = await mkdtemp(join(tmpdir(), 'ariada-bare-'));
    const code = await runCheck({ cwd: dir }, collect().stream, err.stream, {
      scan: async () => EXIT_OK,
      configNames: ['ariada-nothing-is-called-this.json'],
    });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err.text).toContain('ariada-nothing-is-called-this.json');
  });

  it('says the build is missing rather than scanning an empty directory', async () => {
    const err = collect();
    const dir = await mkdtemp(join(tmpdir(), 'ariada-nobuild-'));
    await writeFile(join(dir, 'ariada.json'), JSON.stringify({ root: 'nowhere' }), 'utf8');
    const code = await runCheck({ cwd: dir }, collect().stream, err.stream, { scan: async () => EXIT_OK });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err.text).toMatch(/build the site first/);
  });

  it('refuses to scan something that is not the project page', async () => {
    // The failure this exists for: a scan reached an unrelated service and
    // reported five findings about its error page.
    const err = collect();
    const dir = await project({ root: 'built', pages: ['api.json'] }, {
      'api.json': '{"detail":"Not Found"}',
    });
    const code = await runCheck({ cwd: dir }, collect().stream, err.stream, { scan: async () => EXIT_OK });
    expect(code).toBe(EXIT_INVALID_ARGS);
    expect(err.text).toMatch(/did not return an HTML page/);
  });
});

describe('one line per finding', () => {
  it('reads like a build log: where, how bad, which rule, what is wrong', () => {
    expect(
      findingLine('en/index.html', {
        ruleId: 'color-contrast',
        severity: 'serious',
        message: 'Elements must meet minimum color contrast ratio thresholds',
        element: { selector: '#dropdownMenu1' },
      }),
    ).toBe(
      'en/index.html: serious [color-contrast] Elements must meet minimum color contrast ratio thresholds  — #dropdownMenu1',
    );
  });

  it('leaves off the element when the finding is about the page itself', () => {
    expect(findingLine('index.html', { ruleId: 'html-has-lang', severity: 'serious', message: 'No lang' })).toBe(
      'index.html: serious [html-has-lang] No lang',
    );
  });
});
