import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildZeplinExtensionSnippet, renderZeplinScanTarget, summarizeAriadaScan } from '../src/adapter.js';
import type { ZeplinSnapshot } from '../src/types.js';

async function fixture(): Promise<ZeplinSnapshot> {
  return JSON.parse(await readFile(new URL('../../tests/fixtures/zeplin-export.json', import.meta.url), 'utf8')) as ZeplinSnapshot;
}

test('maps Zeplin styles and layers to a browser-scannable Ariada fixture', async () => {
  const html = renderZeplinScanTarget(await fixture());
  assert.match(html, /Ariada Zeplin extension-panel fixture/);
  assert.match(html, /Muted body copy/);
  assert.match(html, /color:#9ba7b7/);
  assert.match(html, /background:#ffffff/);
});

test('extension snippet stays a handoff adapter and does not claim local WCAG verdicts', async () => {
  const snippet = buildZeplinExtensionSnippet(await fixture());
  assert.equal(snippet.language, 'json');
  assert.match(snippet.code, /@ariada-org\/cli/);
});

test('summarizes shared CLI contrast findings for the Zeplin panel', async () => {
  const result = summarizeAriadaScan(await fixture(), {
    summary: { total: 2, byImpact: { serious: 1, moderate: 1 } },
    report: { findings: { accessibility: [{ ruleId: 'color-contrast', severity: 'serious', message: 'Element has insufficient color contrast.' }, { ruleId: 'image-alt', severity: 'moderate', message: 'Image missing text alternative.' }] } },
    exitCode: 1
  });
  assert.equal(result.status, 'fail');
  assert.equal(result.totalFindings, 2);
  assert.equal(result.contrastFindings, 1);
});

test('marks panel as needs-scan before shared CLI evidence exists', async () => {
  assert.equal(summarizeAriadaScan(await fixture()).status, 'needs-scan');
});
