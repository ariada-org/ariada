import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { buildAriadaArgs, runPrecommit, selectTargetFiles } from '../src/index.js';

function bufferStream(): { stream: Writable; read: () => string } {
  let output = '';
  const stream = new Writable({
    write(chunk, _encoding, callback): void {
      output += String(chunk);
      callback();
    },
  });
  return { stream, read: () => output };
}

describe('@ariada-org/ariada-precommit', () => {
  it('selects staged HTML and template files', () => {
    expect(selectTargetFiles(['src/page.html', 'src/view.twig', 'README.md'])).toEqual([
      'src/page.html',
      'src/view.twig',
    ]);
  });

  it('builds ariada scan arguments for a preview server', () => {
    expect(
      buildAriadaArgs(['/repo/src/page.html'], '/repo', {
        ARIADA_PRECOMMIT_URL_BASE: 'http://127.0.0.1:4173',
      }),
    ).toEqual([
      'scan',
      '--format',
      'json',
      '--severity-threshold',
      'serious',
      'http://127.0.0.1:4173/src/page.html',
    ]);
  });

  it('fails when the ariada CLI gates a known-bad fixture', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ariada-precommit-'));
    const fakeCli = join(tempDir, 'ariada');
    const argsFile = join(tempDir, 'args.txt');
    writeFileSync(
      fakeCli,
      `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(argsFile)}, process.argv.slice(2).join('\\n'));
console.error('known-bad fixture failed ariada gate');
process.exit(1);
`,
    );
    chmodSync(fakeCli, 0o755);

    const stdout = bufferStream();
    const stderr = bufferStream();
    const result = runPrecommit({
      argv: ['tests/fixtures/bad.html', 'README.md'],
      cwd: process.cwd(),
      env: { ARIADA_BIN: fakeCli },
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(result.exitCode).toBe(1);
    expect(result.selectedFiles).toEqual(['tests/fixtures/bad.html']);
    expect(readFileSync(argsFile, 'utf8').split('\n')).toEqual([
      'scan',
      '--format',
      'json',
      '--severity-threshold',
      'serious',
      'tests/fixtures/bad.html',
    ]);
    expect(stderr.read()).toContain('known-bad fixture failed ariada gate');
  });
});
