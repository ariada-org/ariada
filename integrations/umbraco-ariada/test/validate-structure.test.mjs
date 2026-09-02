// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The checker is run against copies of this directory with one thing broken in
// each. Run only against the good tree it would pass whatever it did, including
// nothing — which is what it used to do, under four different gate names.

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const here = import.meta.dirname;
const root = resolve(here, '..');
const validator = resolve(root, 'scripts', 'validate-structure.mjs');

/** A copy of the package with `edit` applied to one of its files. */
function checkWith(edits = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'umbraco-ariada-'));
  cpSync(root, dir, {
    recursive: true,
    filter: (src) => !src.includes('node_modules'),
  });
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
  assert.match(out, /PASS umbraco-ariada structure/);
});

test('a framework the host does not load is refused', () => {
  const { status, out } = checkWith({
    'Ariada.Umbraco.csproj': (s) => s.replace('net8.0', 'net6.0'),
  });
  assert.equal(status, 1);
  assert.match(out, /must target net8\.0/);
});

test('dropping the host reference is refused', () => {
  const { status, out } = checkWith({
    'Ariada.Umbraco.csproj': (s) => s.replace(/<PackageReference[^>]*\/>/, ''),
  });
  assert.equal(status, 1);
  assert.match(out, /Umbraco\.Cms\.Core/);
});

test('two files disagreeing about the version is refused', () => {
  const { status, out } = checkWith({
    'Ariada.Umbraco.csproj': (s) => s.replace('<Version>0.1.0</Version>', '<Version>0.2.0</Version>'),
  });
  assert.equal(status, 1);
  assert.match(out, /version disagrees/);
});

test('two files disagreeing about the licence is refused', () => {
  const { status, out } = checkWith({
    'package.json': (s) => s.replace('"license": "EUPL-1.2"', '"license": "MIT"'),
  });
  assert.equal(status, 1);
  assert.match(out, /licence disagrees/);
});

test('renaming what the scans are attributed to is refused', () => {
  // The failure this exists for: the scans keep working and stop being counted
  // as coming from here, which nothing else would notice.
  const { status, out } = checkWith({
    'src/AriadaScanService.cs': (s) => s.replace('"umbraco.content-app"', '"content-app"'),
  });
  assert.equal(status, 1);
  assert.match(out, /umbraco\.content-app/);
});

test('dropping the check that a content URL resolves is refused', () => {
  const { status, out } = checkWith({
    'src/AriadaScanService.cs': (s) => s.replace('Uri.TryCreate(', 'Ignore.TryCreate('),
  });
  assert.equal(status, 1);
  assert.match(out, /resolve/);
});
