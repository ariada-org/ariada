// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// This checker is the substantial one of its family: it parses the plugin
// rather than searching it, and asserts what the code does rather than what it
// mentions. None of that was ever run against a file it should refuse, so
// nothing said whether the parse was still reaching the assertions — and a
// checker that has only ever seen the good tree is not known to check anything.
//
// Each case breaks one thing the plugin depends on, in the way it actually
// breaks: a hook dropped, a capability loosened, a namespace moved.

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const validator = resolve(root, 'scripts', 'validate-structure.mjs');

function checkWith(edits = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'wordpress-ariada-'));
  cpSync(root, dir, { recursive: true, filter: (src) => !src.includes('node_modules') });
  for (const [file, rewrite] of Object.entries(edits)) {
    const path = join(dir, file);
    writeFileSync(path, rewrite(readFileSync(path, 'utf8')));
  }
  const run = spawnSync(process.execPath, [validator, dir], { encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

test('the plugin as it stands is accepted', () => {
  const { status, out } = checkWith();
  assert.equal(status, 0, out);
  assert.match(out, /PASS wordpress-ariada structure/);
});

test('a syntax error is caught by the parse rather than passed over', () => {
  // The parse is the part that could silently stop working: if it began
  // throwing early, every structural assertion below it would still run
  // against an empty tree and report the same failures forever. So the case
  // that matters is that a broken file fails *as a syntax error*.
  const { status, out } = checkWith({
    'ariada-wordpress.php': (s) => `${s}\nfunction (`,
  });
  assert.equal(status, 1);
  assert.match(out, /syntax error/i);
});

test('a function that is mentioned but not declared is refused', () => {
  const { status, out } = checkWith({
    'ariada-wordpress.php': (s) =>
      s.replace('function ariada_wp_rest_get_report(', 'function ariada_wp_rest_get_report_renamed('),
  });
  assert.equal(status, 1);
  assert.match(out, /ariada_wp_rest_get_report\(\)/);
});

test('dropping the admin menu hook is refused', () => {
  const { status, out } = checkWith({
    'ariada-wordpress.php': (s) => s.replace(/add_action\(\s*'admin_menu'/, "add_action( 'admin_menu_disabled'"),
  });
  assert.equal(status, 1);
  assert.match(out, /admin_menu/);
});

test('loosening the capability the admin page requires is refused', () => {
  // The one with teeth: manage_options is what keeps a scan report out of a
  // subscriber's hands. Replaced with a weaker capability the plugin still
  // works, for everybody.
  const { status, out } = checkWith({
    'ariada-wordpress.php': (s) => s.replaceAll('manage_options', 'read'),
  });
  assert.equal(status, 1);
  assert.match(out, /manage_options/);
});

test('moving the endpoint out of its namespace is refused', () => {
  const { status, out } = checkWith({
    'ariada-wordpress.php': (s) => s.replaceAll("'ariada/v1'", "'ariada/v2'"),
  });
  assert.equal(status, 1);
  assert.match(out, /ariada\/v1/);
});

test('a readme that stops documenting the endpoint is refused', () => {
  const { status, out } = checkWith({
    'readme.txt': (s) => s.replace('/wp-json/ariada/v1/report', '(removed)'),
  });
  assert.equal(status, 1);
  assert.match(out, /readme\.txt/);
});
