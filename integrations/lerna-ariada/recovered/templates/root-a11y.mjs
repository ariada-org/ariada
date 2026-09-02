import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

import { aggregateWorkspace } from '@ariada-org/lerna-ariada';

const require = createRequire(import.meta.url);
const manifestPath = require.resolve('lerna/package.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.lerna;
if (typeof bin !== 'string') throw new Error('Installed Lerna has no CLI entry');
const lernaCli = resolve(dirname(manifestPath), bin);
const lernaExit = await new Promise((resolveExit, reject) => {
  const child = spawn(process.execPath, [lernaCli, 'run', 'a11y', '--no-bail', '--stream'], {
    cwd: process.cwd(),
    env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' },
    shell: false,
    stdio: 'inherit'
  });
  child.once('error', reject);
  child.once('close', (code) => resolveExit(code ?? 3));
});
if (lernaExit !== 0 && lernaExit !== 1) process.exit(lernaExit);
process.exitCode = (await aggregateWorkspace({ reportRoot: 'ariada-output' })).exitCode;
