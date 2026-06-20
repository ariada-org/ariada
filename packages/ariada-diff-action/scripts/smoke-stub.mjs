#!/usr/bin/env node
// SPDX-License-Identifier: EUPL-1.2
//
// Local smoke-test runner for the stub classifier path.
//
// Reads head-scan and base-scan DiffResult JSON files (which already
// carry pre-classified findings), resolves the counts, then renders
// the PR-comment markdown and optionally an HTML page for screenshot
// evidence.
//
// Usage:
//   node scripts/smoke-stub.mjs \
//     --head path/to/head-scan.json \
//     --base path/to/base-scan.json \
//     [--out path/to/out.html]
//
// Exit codes mirror the gate contract:
//   0 — pass (0 new findings)
//   1 — fail (≥1 new findings)
//   2 — input error

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

const { values } = parseArgs({
  options: {
    head: { type: 'string' },
    base: { type: 'string' },
    out: { type: 'string' },
  },
});

if (!values.head || !values.base) {
  console.error('Usage: smoke-stub.mjs --head <path> --base <path> [--out <html-path>]');
  process.exit(2);
}

// Load pre-classified DiffResult JSON (stub already ran)
let headResult;
let baseResult;
try {
  headResult = JSON.parse(readFileSync(values.head, 'utf8'));
  baseResult = JSON.parse(readFileSync(values.base, 'utf8'));
} catch (err) {
  console.error('Failed to read input files:', err.message);
  process.exit(2);
}

// The fixture JSON files ARE the DiffResult objects — they carry
// the classification.counts already. Use them directly.
const counts = headResult.counts;
const newCount = counts.new;
const preExisting = counts.pre_existing;
const resolved = counts.resolved;

const result = newCount > 0 ? 'fail' : 'pass';
const recommendedAction =
  newCount > 0
    ? `Fix ${newCount} new finding${newCount === 1 ? '' : 's'} before merge.`
    : 'Gate passed — no blocking findings.';

const decisionId = `01HVSMOKE${Date.now().toString(36).toUpperCase().padStart(12, '0')}`;

// Render the PR comment markdown using the shared renderer
const { renderPrComment } = await import(join(HERE, 'post-pr-comment.mjs'));

const markdown = renderPrComment({
  result,
  counts: { new: newCount, pre_existing: preExisting, resolved },
  decision_id: decisionId,
  recommended_action: recommendedAction,
});

// Print summary to stdout
console.log(`\n--- ariada-diff stub smoke test ---`);
console.log(`Engine:      stub (equality-only OSS classifier)`);
console.log(`New:         ${newCount}`);
console.log(`Pre-existing: ${preExisting}`);
console.log(`Resolved:    ${resolved}`);
console.log(`Result:      ${result.toUpperCase()}`);
console.log(`\n--- PR comment (markdown) ---\n`);
console.log(markdown);

// Also surface new findings detail if any
if (newCount > 0 && headResult.classification && headResult.classification.new) {
  console.log('\n--- New findings detail ---');
  for (const f of headResult.classification.new) {
    console.log(`  [${f.severity.toUpperCase()}] ${f.ruleId} — ${f.selector} (WCAG 2.1 SC ${f.wcagSc || 'n/a'})`);
  }
}

// Optional HTML output for screenshots
if (values.out) {
  const resultClass = result === 'pass' ? 'pass' : 'fail';
  const resultLabel = result === 'pass' ? 'PASS' : 'FAIL';
  const resultEmoji = result === 'pass' ? '✅' : '❌';
  const borderColor = result === 'pass' ? '#22c55e' : '#ef4444';
  const bgColor = result === 'pass' ? '#052e16' : '#450a0a';

  // Build findings section
  let findingsHtml = '';
  if (newCount > 0 && headResult.classification && headResult.classification.new) {
    findingsHtml = `
      <section aria-label="New findings">
        <h3>New findings (must fix to merge)</h3>
        <ul class="findings-list">
          ${headResult.classification.new.map(f => `
            <li class="finding finding-${f.severity}">
              <span class="finding-rule">${escapeHtml(f.ruleId)}</span>
              <span class="finding-severity badge-${f.severity}">${escapeHtml(f.severity)}</span>
              ${f.wcagSc ? `<span class="finding-wcag">WCAG 2.1 SC ${escapeHtml(f.wcagSc)}</span>` : ''}
              <span class="finding-selector"><code>${escapeHtml(f.selector)}</code></span>
            </li>`).join('\n')}
        </ul>
      </section>`;
  }

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>differential gate — ${resultLabel}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #0a0a0a; color: #e5e5e5; }
    .gate-card {
      border: 2px solid ${borderColor};
      border-radius: 10px;
      background: ${bgColor};
      padding: 24px;
      max-width: 700px;
      margin: 0 auto;
    }
    h2 { margin: 0 0 16px; font-size: 20px; display: flex; align-items: center; gap: 10px; }
    .counts { display: flex; gap: 24px; margin: 16px 0; }
    .count-box { text-align: center; }
    .count-num { font-size: 36px; font-weight: 700; line-height: 1; }
    .count-num.new { color: ${result === 'fail' ? '#f87171' : '#4ade80'}; }
    .count-num.pre { color: #888; }
    .count-num.res { color: #4ade80; }
    .count-label { font-size: 12px; color: #aaa; margin-top: 4px; }
    .recommended { margin: 16px 0; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; font-size: 14px; }
    .findings-list { list-style: none; padding: 0; margin: 0; }
    .finding { padding: 10px 12px; margin: 6px 0; background: rgba(0,0,0,0.3); border-radius: 6px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; }
    .finding-rule { font-weight: 600; font-family: monospace; }
    .finding-selector { color: #888; font-size: 12px; width: 100%; }
    .badge-critical { background: #7f1d1d; color: #fca5a5; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-serious { background: #78350f; color: #fcd34d; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-moderate { background: #1e3a5f; color: #93c5fd; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-minor { background: #1a2e1a; color: #86efac; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .finding-wcag { font-size: 11px; color: #60a5fa; }
    .decision-id { font-size: 11px; color: #666; margin-top: 16px; }
    h3 { font-size: 14px; margin: 16px 0 8px; color: #ccc; }
  </style>
</head>
<body>
  <div class="gate-card" role="main">
    <h2>
      <span aria-hidden="true">${resultEmoji}</span>
      <span>differential accessibility gate — ${resultLabel}</span>
    </h2>
    <div class="counts">
      <div class="count-box">
        <div class="count-num new" aria-label="${newCount} new findings">${newCount}</div>
        <div class="count-label">new findings${result === 'fail' ? ' (must fix)' : ''}</div>
      </div>
      <div class="count-box">
        <div class="count-num pre" aria-label="${preExisting} pre-existing findings">${preExisting}</div>
        <div class="count-label">pre-existing findings (not blocking)</div>
      </div>
      <div class="count-box">
        <div class="count-num res" aria-label="${resolved} resolved">${resolved}</div>
        <div class="count-label">resolved by this PR</div>
      </div>
    </div>
    <div class="recommended" role="status" aria-live="polite">
      ${escapeHtml(recommendedAction)}
    </div>
    ${findingsHtml}
    <p class="decision-id">Decision ID: <code>${escapeHtml(decisionId)}</code> · engine: stub (OSS equality classifier)</p>
  </div>
</body>
</html>`;

  writeFileSync(values.out, html, 'utf8');
  console.log(`\nHTML output written to: ${values.out}`);
}

process.exit(newCount > 0 ? 1 : 0);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
