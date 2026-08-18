// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  outputPath,
  pageUrls,
  readProjectConfig,
  siteRoot,
} from '../src/project-config.js';

async function configFile(contents: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'ariada-config-'));
  const path = join(dir, 'ariada.json');
  await writeFile(path, contents, 'utf8');
  return path;
}

describe('reading what a project asks for', () => {
  it('takes the pages and the built directory from the file', async () => {
    const path = await configFile(
      JSON.stringify({ root: '_build/html', pages: ['index.html', 'manual/index.html'] }),
    );
    const config = await readProjectConfig(path);
    expect(config.pages).toEqual(['index.html', 'manual/index.html']);
    expect(siteRoot(config).endsWith('/_build/html')).toBe(true);
  });

  it('fills in what a static site would want when the file says little', async () => {
    const config = await readProjectConfig(await configFile('{}'));
    expect(config.root).toBe('.');
    expect(config.pages).toEqual(['index.html']);
    expect(config.outputDir).toBe('ariada-report');
    expect(config.domains).toBeUndefined();
  });

  it('resolves paths against the file, not against whoever ran the command', async () => {
    // A rule may be invoked from anywhere; the project's own paths cannot
    // depend on that.
    const path = await configFile(JSON.stringify({ root: 'rendered', outputDir: 'out' }));
    const config = await readProjectConfig(path);
    expect(siteRoot(config)).toBe(join(config.dir, 'rendered'));
    expect(outputPath(config)).toBe(join(config.dir, 'out'));
  });

  it('refuses an empty page list rather than checking nothing quietly', async () => {
    await expect(readProjectConfig(await configFile('{"pages": []}'))).rejects.toThrow(
      /nothing would be checked/,
    );
  });

  it('says what is wrong with the file, naming the file', async () => {
    const path = await configFile('{ not json');
    await expect(readProjectConfig(path)).rejects.toThrow(/not valid JSON/);
    await expect(readProjectConfig(path)).rejects.toThrow(path);
  });

  it('rejects a severity nobody defines', async () => {
    await expect(
      readProjectConfig(await configFile('{"severityThreshold": "urgent"}')),
    ).rejects.toThrow(/minor, moderate, serious, critical/);
  });

  it('reports a missing file as unreadable rather than as an empty project', async () => {
    await expect(readProjectConfig('/nowhere/ariada.json')).rejects.toThrow(/cannot be read/);
  });
});

describe('turning pages into addresses', () => {
  it('joins each page onto the base the site is served from', () => {
    expect(pageUrls({ pages: ['en/index.html', 'de/index.html'] }, 'http://127.0.0.1:8099')).toEqual(
      ['http://127.0.0.1:8099/en/index.html', 'http://127.0.0.1:8099/de/index.html'],
    );
  });

  it('does not care whether the base or the page carries the slash', () => {
    expect(pageUrls({ pages: ['/index.html'] }, 'http://127.0.0.1:8099/')).toEqual([
      'http://127.0.0.1:8099/index.html',
    ]);
  });
});
