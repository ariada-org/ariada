#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const evidenceDir = resolve(root, 'scan-evidence');
const screenshotDir = resolve(evidenceDir, 'screenshots');
const shapes = JSON.parse(await readFile(resolve(root, 'fixtures/penpot-selection.json'), 'utf8'));
const checks = JSON.parse(await readFile(resolve(evidenceDir, 'design-checks.json'), 'utf8'));

const panelHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ariada Penpot plugin panel fixture</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:0;background:#eef2f7;color:#172033}
main{width:520px;min-height:640px;background:#f8fafc;padding:18px;box-sizing:border-box}
h1{font-size:20px;margin:0 0 4px}.meta{color:#526071;margin:0 0 16px}
.toolbar{display:flex;gap:8px;margin-bottom:14px}.button{background:#172033;color:#fff;border:0;border-radius:6px;padding:8px 12px}.ghost{background:#fff;color:#172033;border:1px solid #b8c4d4}
.panel{background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin-bottom:12px}
.status{display:inline-block;border-radius:999px;padding:2px 8px;font-weight:700}.fail{background:#ffe2e0;color:#8c1d18}.pass{background:#dff7e7;color:#116329}
table{width:100%;border-collapse:collapse}td,th{border-top:1px solid #e2e8f0;padding:7px;text-align:left;vertical-align:top}
.board{height:150px;position:relative;background:#fff;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden}.shape{position:absolute;border-radius:4px}.text{color:#b8bec8}.tiny{width:18px;height:18px;background:#e8edf5;border:1px solid #334155}
</style>
</head>
<body>
<main>
<h1>Ariada Accessibility Evidence</h1>
<p class="meta">Penpot plugin panel fixture: selected board export plus design-time hints.</p>
<div class="toolbar"><button class="button">Export selected shapes</button><button class="button ghost">Download HTML</button></div>
<section class="panel"><strong>Selection</strong><p>${shapes[0].children.length} child shapes from ${shapes[0].name}. Canonical scan runs through @ariada-org/cli.</p></section>
<section class="board" aria-label="Plugin panel visual preview">
<p class="shape text" style="left:24px;top:20px">Subscription renews automatically</p>
<span class="shape tiny" style="left:24px;top:72px"></span>
<span class="shape" style="left:24px;top:108px;width:132px;height:32px;background:#34d399"></span>
</section>
<section class="panel">
<table><thead><tr><th>Check</th><th>Verdict</th><th>Value</th></tr></thead><tbody>
${checks
  .map(
    (check) =>
      `<tr><td>${check.shapeName}</td><td><span class="status ${check.status}">${check.status}</span></td><td>${check.value}</td></tr>`,
  )
  .join('')}
</tbody></table>
</section>
</main>
</body>
</html>`;

await mkdir(screenshotDir, { recursive: true });
const previewPath = resolve(evidenceDir, 'plugin-panel-fixture.html');
await writeFile(previewPath, panelHtml, 'utf8');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 560, height: 700 }, deviceScaleFactor: 2 });
  await page.goto(`file://${previewPath}`);
  await page.screenshot({ path: resolve(screenshotDir, 'plugin-panel.png'), fullPage: true });
} finally {
  await browser.close();
}

console.log(`Captured ${resolve(screenshotDir, 'plugin-panel.png')}`);
