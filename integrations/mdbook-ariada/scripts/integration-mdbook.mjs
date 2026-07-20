#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

import { scanMdBookOutput } from '../src/index.mjs';

const mdbook = spawnSync('mdbook', ['--version'], { encoding: 'utf8' });
if (mdbook.error?.code === 'ENOENT') {
  console.log('BLOCKED mdbook integration test: mdbook binary is not installed on this host.');
  process.exit(0);
}
if (mdbook.status !== 0) {
  console.log(`BLOCKED mdbook integration test: mdbook --version failed: ${mdbook.stderr || mdbook.stdout}`);
  process.exit(0);
}

const root = await mkdtemp(join(tmpdir(), 'ariada-mdbook-integration-'));
try {
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'book.toml'), '[book]\ntitle = "Ariada fixture"\n', 'utf8');
  await writeFile(join(root, 'src', 'SUMMARY.md'), '# Summary\n\n- [Intro](intro.md)\n', 'utf8');
  await writeFile(join(root, 'src', 'intro.md'), '# Intro\n\n<img src="missing-alt.png">\n', 'utf8');

  const build = spawnSync('mdbook', ['build', root], { encoding: 'utf8' });
  if (build.status !== 0) {
    throw new Error(`mdbook build failed:\n${build.stderr || build.stdout}`);
  }
  await access(join(root, 'book', 'intro.html'), constants.R_OK);

  const code = await scanMdBookOutput(
    {
      bookDir: join(root, 'book'),
      outputDir: join(root, 'ariada-output'),
      cliBin: process.env.ARIADA_CLI_BIN ?? 'ariada',
      format: 'json',
    },
    async () => 1,
  );
  if (code !== 1) throw new Error(`expected injected Ariada runner to return 1, got ${code}`);
  console.log('PASS mdbook integration fixture builds and invokes Ariada wrapper.');
} finally {
  await rm(root, { recursive: true, force: true });
}
