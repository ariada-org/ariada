// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The checker is run against copies of this directory with one thing broken in
// each. Run only against the good tree it would pass whatever it did, including
// nothing — which is what it used to do, under three different gate names.

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const validator = resolve(root, 'scripts', 'validate-structure.mjs');

function checkWith(edits = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'craft-ariada-'));
  cpSync(root, dir, { recursive: true, filter: (src) => !src.includes('node_modules') });
  for (const [file, rewrite] of Object.entries(edits)) {
    const path = join(dir, file);
    writeFileSync(path, rewrite(readFileSync(path, 'utf8')));
  }
  const run = spawnSync(process.execPath, [validator, dir], { encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

test('the package as it stands is accepted', () => {
  const { status, out } = checkWith();
  assert.equal(status, 0, out);
  assert.match(out, /PASS craft-ariada structure/);
});

test('a package type the host does not recognise is refused', () => {
  const { status, out } = checkWith({
    'composer.json': (s) => s.replace('"craft-plugin"', '"library"'),
  });
  assert.equal(status, 1);
  assert.match(out, /package type/);
});

test('a namespace the autoloader and the source disagree on is refused', () => {
  const { status, out } = checkWith({
    'src/Plugin.php': (s) => s.replace(/^namespace .+;$/m, 'namespace Elsewhere;'),
  });
  assert.equal(status, 1);
  assert.match(out, /namespace disagrees/);
});

test('mentioning a method instead of declaring it is refused', () => {
  const { status, out } = checkWith({
    'src/Plugin.php': (s) => s.replace('function scanRequest(', '// function scanRequest was here: scanRequest('),
  });
  assert.equal(status, 1);
  assert.match(out, /scanRequest/);
});

test('renaming what the scans are attributed to is refused', () => {
  // The failure this exists for: the scans keep working and stop being counted
  // as coming from here, which nothing else would notice.
  const { status, out } = checkWith({
    'src/Plugin.php': (s) => s.replace("'craft.entry'", "'entry'"),
  });
  assert.equal(status, 1);
  assert.match(out, /craft\.entry/);
});
