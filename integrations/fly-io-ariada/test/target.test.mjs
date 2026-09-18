// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Resolving the address is where this wrapper can be silently wrong. Scanning
// the wrong deployment reports a clean site, and nothing about the report says
// it looked at the wrong thing. So: every place a build has been seen to put
// its address is read, two that disagree are a refusal rather than a
// first-one-wins, and an address that cannot be scanned is refused by name.

import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { loadConfig } from '../dist/config.js';
import { resolveTarget } from '../dist/target.js';

const config = (environment) => loadConfig(environment, process.cwd());

test('an explicit address wins, and says where it came from', async () => {
  const resolved = await resolveTarget(config({ ARIADA_TARGET_URL: 'https://example.test/' }));
  assert.deepEqual(resolved, { url: 'https://example.test/', source: 'target-url' });
});

test('a build output is read, from a path or from the value itself', async () => {
  const inline = await resolveTarget(config({ ARIADA_BUILD_OUTPUT: '{"url":"https://a.test/"}' }));
  assert.equal(inline.url, 'https://a.test/');
  assert.equal(inline.source, 'build-output');

  const dir = await mkdtemp(join(tmpdir(), 'fly-ariada-'));
  const file = join(dir, 'out.json');
  await writeFile(file, JSON.stringify({ app: { hostname: 'b.test' } }));
  const fromFile = await resolveTarget(loadConfig({ ARIADA_BUILD_OUTPUT: file }, dir));
  assert.equal(fromFile.url, 'https://b.test/');
});

test('two fields that disagree are refused rather than picked between', async () => {
  // Scanning the wrong deployment reports a clean site, and the report does not
  // say it looked elsewhere. A conflict is the one case worth stopping for.
  await assert.rejects(
    resolveTarget(config({ ARIADA_BUILD_OUTPUT: '{"url":"https://a.test/","hostname":"b.test"}' })),
    /conflicting target URL fields/,
  );
});

test('two fields that agree are not a conflict', async () => {
  const resolved = await resolveTarget(config({
    ARIADA_BUILD_OUTPUT: '{"url":"https://a.test/","app":{"url":"https://a.test/"}}',
  }));
  assert.equal(resolved.url, 'https://a.test/');
});

test('an address that cannot be scanned is refused by name', async () => {
  await assert.rejects(resolveTarget(config({ ARIADA_TARGET_URL: 'ftp://a.test/' })), /must use http or https/);
  await assert.rejects(resolveTarget(config({ ARIADA_TARGET_URL: 'https://u:p@a.test/' })), /must not embed credentials/);
  await assert.rejects(resolveTarget(config({ ARIADA_TARGET_URL: 'not a url' })), /is not a valid URL/);
});

test('the application name becomes its own address, and a bad name is refused', async () => {
  const resolved = await resolveTarget(config({ FLY_APP_NAME: 'my-app' }));
  assert.deepEqual(resolved, { url: 'https://my-app.fly.dev/', source: 'fly-app-name' });
  await assert.rejects(resolveTarget(config({ FLY_APP_NAME: 'Bad_Name' })), /not a valid Fly app name/);
  await assert.rejects(resolveTarget(config({ FLY_APP_NAME: 'a'.repeat(64) })), /not a valid Fly app name/);
});

test('a build output naming nothing usable is refused, and so is nothing at all', async () => {
  await assert.rejects(resolveTarget(config({ ARIADA_BUILD_OUTPUT: '{"other":1}' })), /does not contain a supported target URL field/);
  await assert.rejects(resolveTarget(config({ ARIADA_BUILD_OUTPUT: 'not json' })), /could not be read|not valid JSON/);
  await assert.rejects(resolveTarget(config({})), /Set ARIADA_TARGET_URL, ARIADA_BUILD_OUTPUT, or FLY_APP_NAME/);
});
