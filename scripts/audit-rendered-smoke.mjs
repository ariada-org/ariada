// SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
// SPDX-License-Identifier: EUPL-1.2
//
// Quick smoke audit of /tmp/*.html files via headless chromium + axe-core.
// Used to verify @ariada-org/scan-report-html + @ariada-org/vpat-html-renderer
// renderers ship WCAG 2.2 AA-conformant output (eat-our-own-dog-food).
//
// NOT part of the package test suite — this is a session-time verification helper.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function audit(filePath, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${filePath}`);
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => await window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  await browser.close();

  const v = results.violations;
  console.log(`\n=== ${label} ===`);
  console.log(`File: ${filePath}`);
  console.log(`Violations: ${v.length}`);
  console.log(`  critical: ${v.filter(x => x.impact === 'critical').length}`);
  console.log(`  serious:  ${v.filter(x => x.impact === 'serious').length}`);
  console.log(`  moderate: ${v.filter(x => x.impact === 'moderate').length}`);
  console.log(`  minor:    ${v.filter(x => x.impact === 'minor').length}`);
  console.log(`Passes:     ${results.passes.length}`);
  console.log(`Incomplete: ${results.incomplete.length}`);
  if (v.length) {
    console.log('\nTop violations:');
    for (const x of v.slice(0, 5)) {
      console.log(`  - [${x.impact}] ${x.id}: ${x.help}`);
      console.log(`    nodes: ${x.nodes.length}; helpUrl: ${x.helpUrl}`);
    }
  }
  return v.length;
}

const s1 = await audit('/tmp/scan-report-smoke.html', '@ariada-org/scan-report-html');
const s2 = await audit('/tmp/vpat-smoke.html', '@ariada-org/vpat-html-renderer');

console.log('\n=== VERDICT ===');
console.log(`scan-report-html: ${s1 === 0 ? '✅ WCAG 2.2 AA PASS' : `❌ ${s1} violations`}`);
console.log(`vpat-html:        ${s2 === 0 ? '✅ WCAG 2.2 AA PASS' : `❌ ${s2} violations`}`);
process.exit(s1 + s2 > 0 ? 1 : 0);
