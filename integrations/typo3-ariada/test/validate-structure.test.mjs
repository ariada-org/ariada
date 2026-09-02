// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The end-to-end smoke run needs PHP and a container host and refuses loudly
// without them, which is right — but it left this extension with nothing that
// could be checked on an ordinary machine. These cases break one agreement each,
// in the way it actually breaks: a class moved out of its namespace, the
// extension renamed in one of the two places that spell it, the routed
// controller unknown to the container.

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const validator = resolve(root, 'scripts', 'validate-structure.mjs');

function checkWith(edits = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'typo3-ariada-'));
  cpSync(root, dir, { recursive: true, filter: (src) => !src.includes('node_modules') });
  for (const [file, rewrite] of Object.entries(edits)) {
    const path = join(dir, file);
    writeFileSync(path, rewrite(readFileSync(path, 'utf8')));
  }
  const run = spawnSync(process.execPath, [validator, dir], { encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

test('the extension as it stands is accepted', () => {
  const { status, out } = checkWith();
  assert.equal(status, 0, out);
  assert.match(out, /PASS typo3-ariada structure/);
});

test('a package type the host does not recognise is refused', () => {
  const { status, out } = checkWith({
    'composer.json': (s) => s.replace('"typo3-cms-extension"', '"library"'),
  });
  assert.equal(status, 1);
  assert.match(out, /package type/);
});

test('a class outside the autoloaded namespace is refused', () => {
  // The failure this exists for: nothing fails to build, the host simply
  // cannot find the class when it comes to load it.
  const { status, out } = checkWith({
    'Classes/Service/ScanRunner.php': (s) =>
      s.replace(/^namespace .+;$/m, 'namespace Ariada\\Elsewhere;'),
  });
  assert.equal(status, 1);
  assert.match(out, /outside the autoloaded/);
});

test('renaming the extension in one of the two places that spell it is refused', () => {
  const { status, out } = checkWith({
    'composer.json': (s) => s.replace('"extension-key": "typo3_ariada"', '"extension-key": "typo3_ariada_renamed"'),
  });
  assert.equal(status, 1);
  assert.match(out, /EXT:typo3_ariada_renamed/);
});

test('routing to a controller the container does not know is refused', () => {
  const { status, out } = checkWith({
    'Configuration/Services.yaml': (s) =>
      s.replace(/^ {2}Ariada\\Typo3Ariada\\Controller\\BackendModuleController:$/m, '  Ariada\\Typo3Ariada\\Controller\\Gone:'),
  });
  assert.equal(status, 1);
  assert.match(out, /cannot be built/);
});

test('a classic manifest with no version is refused', () => {
  const { status, out } = checkWith({
    'ext_emconf.php': (s) => s.replace(/'version' => '[^']+',/, ''),
  });
  assert.equal(status, 1);
  assert.match(out, /no version/);
});
