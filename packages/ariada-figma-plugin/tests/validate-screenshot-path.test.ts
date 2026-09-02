// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// The screenshot validator takes a path on the command line and reads it. That
// makes the argument the thing that decides which file gets opened, and an
// argument is not always written by the person who wrote the script — a task
// runner, a generated command, an agent driving the repository. Left as it was,
// `../../..` in that argument read whatever it pointed at and reported on it.
//
// So the resolved path has to land inside the package, and these hold both
// halves of that: the file it is meant to read still works, and one that
// resolves outside is refused. Only the second one goes red when the check is
// removed, which is why the first is here too — a guard that only ever says no
// would pass just as well with the script broken.

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const pkgRoot = resolve(import.meta.dirname, '..');
const script = resolve(pkgRoot, 'scripts/validate-screenshot.mjs');

function run(arg: string): { code: number; output: string } {
  try {
    const output = execFileSync('node', [script, arg], {
      cwd: pkgRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, output };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('the screenshot validator and the path it is given', () => {
  it('reads the evidence screenshot the package ships', () => {
    const { code, output } = run('scan-evidence/screenshot.png');
    expect(code).toBe(0);
    expect(output).toMatch(/is \d+x\d+ with \d+ sampled colors/);
  });

  it('refuses a relative path that climbs out of the package', () => {
    const { code, output } = run('../../README.md');
    expect(code).not.toBe(0);
    expect(output).toContain('resolves outside');
  });

  it('refuses an absolute path elsewhere on the machine', () => {
    const { code, output } = run('/etc/hosts');
    expect(code).not.toBe(0);
    expect(output).toContain('resolves outside');
  });
});
