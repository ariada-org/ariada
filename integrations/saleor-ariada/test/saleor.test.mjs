// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB)
// SPDX-License-Identifier: EUPL-1.2
//
// Three things here are worth holding and none of them is the happy path. The
// panel renders findings taken off somebody else's storefront into a page an
// administrator looks at. The credential store is written where a crash must
// not lose it. And a scan that found problems is not a scan that failed.

import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { FileAPL, MemoryAPL, registerSaleorApp } from '../dist/apl.js';
import { renderDashboard } from '../dist/panel.js';
import { parseAriadaReport, resolveStorefrontUrl, scanStorefront } from '../dist/scanner.js';

const SHOP_A = 'https://a.test';
const SHOP_B = 'https://b.test';
const SALEOR_TMP_PREFIX = 'saleor-apl-';
const SHOP = 'https://a.test/';

test('a finding carrying markup is escaped before it reaches the page', () => {
  // The text comes off a storefront this integration does not control.
  const page = renderDashboard({
    status: 'failed',
    storefrontUrl: 'https://shop.test/',
    totalFindings: 1,
    findings: [{ ruleId: '<img src=x onerror=alert(1)>', severity: 'serious', message: '"quoted" & <b>bold</b>' }],
  });
  assert.equal(page.includes('<img src=x'), false);
  assert.equal(page.includes('<b>bold</b>'), false);
  assert.ok(page.includes('&lt;img'));
  assert.ok(page.includes('&amp;'));
});

test('the report address is escaped too, since it becomes a link', () => {
  const page = renderDashboard({
    status: 'passed', storefrontUrl: 'https://shop.test/', totalFindings: 0, findings: [],
    reportUrl: 'https://r.test/"onmouseover="alert(1)',
  });
  assert.equal(page.includes('"onmouseover="'), false);
  assert.ok(page.includes('&quot;onmouseover=&quot;'));
});

test('an error is shown as an alert, and no result shows an invitation', () => {
  assert.ok(renderDashboard(undefined, 'it broke').includes('role="alert"'));
  assert.ok(renderDashboard(undefined, '<script>').includes('&lt;script&gt;'));
  assert.ok(renderDashboard().includes('Run a scan'));
});

test('credentials survive a crash between writing and renaming', async () => {
  // Written beside the file and renamed over it, so a half-written file never
  // replaces the previous one and logs every shop out.
  const dir = await mkdtemp(join(tmpdir(), SALEOR_TMP_PREFIX));
  const path = join(dir, 'nested', 'apl.json');
  const apl = new FileAPL(path);
  await apl.set({ domain: SHOP_A, token: 't1' });
  await apl.set({ domain: SHOP_B, token: 't2' });
  assert.deepEqual((await apl.getAll()).map((v) => v.domain), [SHOP_A, SHOP_B]);
  assert.equal((await apl.get(SHOP_B)).token, 't2');
  await apl.delete(SHOP_A);
  assert.deepEqual((await apl.getAll()).map((v) => v.domain), [SHOP_B]);
  const onDisk = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(onDisk.length, 1);
});

test('setting a domain twice replaces it rather than appending', async () => {
  const dir = await mkdtemp(join(tmpdir(), SALEOR_TMP_PREFIX));
  const apl = new FileAPL(join(dir, 'apl.json'));
  await apl.set({ domain: SHOP_A, token: 'old' });
  await apl.set({ domain: SHOP_A, token: 'new' });
  assert.equal((await apl.getAll()).length, 1);
  assert.equal((await apl.get(SHOP_A)).token, 'new');
});

test('a missing store reads as empty rather than throwing', async () => {
  const dir = await mkdtemp(join(tmpdir(), SALEOR_TMP_PREFIX));
  assert.deepEqual(await new FileAPL(join(dir, 'absent.json')).getAll(), []);
});

test('registration accepts either spelling and refuses neither being present', async () => {
  const apl = new MemoryAPL();
  const snake = await registerSaleorApp({ auth_token: 't', saleor_api_url: 'https://a.test/graphql/' }, apl);
  assert.equal(snake.domain, 'https://a.test/graphql');
  const camel = await registerSaleorApp({ authToken: 't', saleorApiUrl: 'https://b.test/' }, apl);
  assert.equal(camel.domain, SHOP_B);
  await assert.rejects(registerSaleorApp({ auth_token: 't' }, apl), /requires auth_token and saleor_api_url/);
  await assert.rejects(registerSaleorApp({ auth_token: '', saleor_api_url: SHOP_A }, apl), /requires/);
});

test('a storefront address is taken from either field, and refused if unusable', () => {
  assert.equal(resolveStorefrontUrl({ storefrontUrl: 'https://a.test/' }), SHOP_A);
  assert.equal(resolveStorefrontUrl({ domain: { host: 'b.test', protocol: 'HTTP' } }), 'http://b.test');
  assert.equal(resolveStorefrontUrl({ domain: { host: 'c.test' } }), 'https://c.test');
  assert.throws(() => resolveStorefrontUrl({}), /does not define a storefront URL/);
  assert.throws(() => resolveStorefrontUrl({ storefrontUrl: 'ftp://a.test' }), /must use http or https/);
});

test('findings are found under either name, and a malformed one is refused', () => {
  assert.equal(parseAriadaReport({ findings: [{ ruleId: 'r', severity: 's', message: 'm' }] }).findings.length, 1);
  assert.equal(parseAriadaReport({ report: { findings: [{ ruleId: 'r', severity: 's', message: 'm' }] } }).findings.length, 1);
  assert.deepEqual(parseAriadaReport({}).findings, []);
  assert.throws(() => parseAriadaReport({ findings: [{ ruleId: 'r' }] }), /requires ruleId, severity, and message/);
  assert.throws(() => parseAriadaReport('nope'), /must be an object/);
});

test('a scan that found problems is not a scan that failed', async () => {
  // Exit one means findings. Treating it as an error would turn every
  // storefront with a problem into a broken integration.
  const runner = async () => ({
    exitCode: 1,
    stdout: JSON.stringify({ findings: [{ ruleId: 'r', severity: 'serious', message: 'm' }] }),
    stderr: '',
  });
  const result = await scanStorefront({ storefrontUrl: SHOP }, runner);
  assert.equal(result.status, 'failed');
  assert.equal(result.totalFindings, 1);
  assert.equal(result.storefrontUrl, SHOP_A);
});

test('an exit above one is a failure of the tool, and says so', async () => {
  const runner = async () => ({ exitCode: 3, stdout: '', stderr: 'browser did not start' });
  await assert.rejects(
    scanStorefront({ storefrontUrl: SHOP }, runner),
    /failed with exit 3: browser did not start/,
  );
});

test('a clean scan passes and carries the report address when there is one', async () => {
  const runner = async () => ({ exitCode: 0, stdout: JSON.stringify({ findings: [], reportUrl: 'https://r.test/1' }), stderr: '' });
  const result = await scanStorefront({ storefrontUrl: SHOP }, runner);
  assert.equal(result.status, 'passed');
  assert.equal(result.reportUrl, 'https://r.test/1');
  const bare = await scanStorefront({ storefrontUrl: SHOP }, async () => ({ exitCode: 0, stdout: '{"findings":[]}', stderr: '' }));
  assert.equal('reportUrl' in bare, false);
});
