// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The wrapper's config is what ties this directory to the extension it wraps:
// which package supplies the built extension, where that build lands, what
// bundle the wrapper claims. Each of those can drift — a package rename, a
// build output moved — and the drift is invisible until someone tries to ship.
//
// A checker run only against the good file proves nothing. These run it against
// files it must refuse, which is the only way to know it is still looking.

import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const here = import.meta.dirname;
const validator = resolve(here, '..', 'scripts', 'validate-config.mjs');
const goodConfigPath = resolve(here, '..', 'config', 'safari-wrapper.json');
const goodConfig = JSON.parse(readFileSync(goodConfigPath, 'utf8'));

function check(config) {
  const dir = mkdtempSync(join(tmpdir(), 'safari-wrapper-'));
  const path = join(dir, 'safari-wrapper.json');
  writeFileSync(path, JSON.stringify(config, null, 2));
  const run = spawnSync(process.execPath, [validator, path], { encoding: 'utf8' });
  return { status: run.status, out: `${run.stdout}${run.stderr}` };
}

test('the config this directory ships is accepted', () => {
  const { status, out } = check(goodConfig);
  assert.equal(status, 0, out);
  assert.match(out, /Safari wrapper config valid/);
});

test('a missing field is refused, and named', () => {
  const { appName, ...withoutAppName } = goodConfig;
  const { status, out } = check(withoutAppName);
  assert.equal(status, 1);
  assert.match(out, /config\.appName/);
});

test('an empty field is refused as firmly as a missing one', () => {
  const { status, out } = check({ ...goodConfig, scheme: '   ' });
  assert.equal(status, 1);
  assert.match(out, /config\.scheme/);
});

test('a bundle identifier that is not reverse-DNS-safe is refused', () => {
  const { status, out } = check({ ...goodConfig, bundleIdentifier: 'org ariada app' });
  assert.equal(status, 1);
  assert.match(out, /reverse-DNS-safe/);
});

test('naming a package that is not the extension is refused', () => {
  const { status, out } = check({ ...goodConfig, extensionPackage: '@ariada-org/not-the-extension' });
  assert.equal(status, 1);
  assert.match(out, /extension package mismatch/);
});

test('a build directory outside the extension package is refused', () => {
  // The escape that matters: a path that resolves out of the package while
  // reading as though it stays inside it.
  const { status, out } = check({
    ...goodConfig,
    webExtensionDir: '../../packages/extension-chrome/../overlay',
  });
  assert.equal(status, 1);
  assert.match(out, /webExtensionDir/);
});

test('the Makefile and the config say the same things', () => {
  // The Makefile keeps its own copy of four of these values, because make
  // cannot read JSON without help. Two copies of the same fact drift, and the
  // morning after they drift the wrapper is built against the wrong output
  // with nothing red anywhere.
  const makefile = readFileSync(resolve(here, '..', 'Makefile'), 'utf8');
  const variable = (name) => makefile.match(new RegExp(`^${name} :?= (.+)$`, 'm'))?.[1]?.trim();

  assert.equal(variable('EXTENSION_PACKAGE'), goodConfig.extensionPackage);
  assert.equal(variable('WEB_EXTENSION_DIR'), goodConfig.webExtensionDir);
  assert.equal(variable('PROJECT_DIR'), goodConfig.projectDir);
  assert.equal(variable('SCHEME'), goodConfig.scheme);
});
