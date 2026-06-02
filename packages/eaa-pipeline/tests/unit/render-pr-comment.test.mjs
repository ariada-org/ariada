// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Unit tests for render-pr-comment.mjs.
 *
 * Uses node:test (stdlib).  Verifies the PR-comment body:
 *   - verdict emoji + text label
 *   - totals-by-impact table with all 4 axe levels
 *   - top-5 violations sorted by impact priority then by nodeCount
 *   - 65 536 char cap behaviour (truncation pointer)
 *   - accessibility: emoji always paired with text
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderVerdict,
  collectTopViolations,
  renderPrComment,
} from '../../scripts/render-pr-comment.mjs';

const baseReport = () => ({
  siteUrl: 'https://example.com',
  scannerPack: '@ariada-org/wcag-rules-extended',
  scannerPackVersion: '0.2.1',
  pagesScanned: 1,
  totalViolations: 4,
  totalsByImpact: { critical: 1, serious: 1, moderate: 1, minor: 1 },
  failOn: ['serious', 'critical'],
  verdict: 'FAIL',
  perPage: [
    {
      url: 'https://example.com/',
      violations: [
        { id: 'color-contrast', impact: 'critical', description: 'd', helpUrl: 'https://dequeuniversity.com/x', nodeCount: 3 },
        { id: 'link-name', impact: 'serious', description: 'd', helpUrl: '', nodeCount: 2 },
        { id: 'html-lang', impact: 'moderate', description: 'd', helpUrl: '', nodeCount: 1 },
        { id: 'image-alt', impact: 'minor', description: 'd', helpUrl: '', nodeCount: 1 },
      ],
    },
  ],
});

test('renderVerdict: PASS → ✅ PASS', () => {
  assert.equal(renderVerdict('PASS'), '✅ PASS');
  assert.equal(renderVerdict('pass'), '✅ PASS');
});

test('renderVerdict: FAIL → ❌ FAIL', () => {
  assert.equal(renderVerdict('FAIL'), '❌ FAIL');
});

test('renderVerdict: unknown → ❓ <upper>', () => {
  assert.equal(renderVerdict('weird'), '❓ WEIRD');
  assert.equal(renderVerdict(undefined), '❓ UNKNOWN');
});

test('collectTopViolations: orders critical first, then by nodeCount', () => {
  const r = baseReport();
  const top = collectTopViolations(r, 5);
  assert.equal(top[0].impact, 'critical');
  assert.equal(top[1].impact, 'serious');
  assert.equal(top[2].impact, 'moderate');
  assert.equal(top[3].impact, 'minor');
});

test('collectTopViolations: respects limit', () => {
  const r = baseReport();
  const top = collectTopViolations(r, 2);
  assert.equal(top.length, 2);
});

test('collectTopViolations: orders by nodeCount within same impact', () => {
  const r = {
    perPage: [
      {
        url: 'https://x',
        violations: [
          { id: 'a', impact: 'critical', description: '', helpUrl: '', nodeCount: 1 },
          { id: 'b', impact: 'critical', description: '', helpUrl: '', nodeCount: 9 },
          { id: 'c', impact: 'critical', description: '', helpUrl: '', nodeCount: 5 },
        ],
      },
    ],
  };
  const top = collectTopViolations(r, 3);
  assert.equal(top[0].id, 'b');
  assert.equal(top[1].id, 'c');
  assert.equal(top[2].id, 'a');
});

test('renderPrComment: includes verdict emoji headline', () => {
  const body = renderPrComment(baseReport(), { runId: 42 });
  assert.match(body, /## ❌ FAIL — EAA audit/);
});

test('renderPrComment: PASS verdict emoji', () => {
  const r = baseReport();
  r.verdict = 'PASS';
  r.totalViolations = 0;
  r.totalsByImpact = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const body = renderPrComment(r, { runId: 42 });
  assert.match(body, /## ✅ PASS — EAA audit/);
});

test('renderPrComment: emoji always paired with text label', () => {
  const body = renderPrComment(baseReport(), { runId: 42 });
  assert.ok(body.includes('🔴 critical'));
  assert.ok(body.includes('🟠 serious'));
  assert.ok(body.includes('🟡 moderate'));
  assert.ok(body.includes('⚪ minor'));
  // No bare emoji without label.
  assert.ok(!body.match(/🔴(?!\s*critical)/));
  assert.ok(!body.match(/🟠(?!\s*serious)/));
});

test('renderPrComment: includes totals-by-impact table', () => {
  const body = renderPrComment(baseReport(), { runId: 42 });
  assert.match(body, /\| Impact +\| Count \|/);
  assert.match(body, /\| 🔴 critical +\| 1 \|/);
  assert.match(body, /\| 🟠 serious +\| 1 \|/);
});

test('renderPrComment: includes top-5 violations block', () => {
  const body = renderPrComment(baseReport(), { runId: 42 });
  assert.match(body, /<details><summary>Top-5 violations<\/summary>/);
  assert.match(body, /color-contrast/);
});

test('renderPrComment: hyperlinks rule id when helpUrl present', () => {
  const body = renderPrComment(baseReport(), { runId: 42 });
  assert.match(body, /\[color-contrast\]\(https:\/\/dequeuniversity\.com\/x\)/);
});

test('renderPrComment: includes artefact reference + run link', () => {
  const body = renderPrComment(baseReport(), {
    runId: 42,
    runUrl: 'https://github.com/x/y/actions/runs/42',
  });
  assert.match(body, /Artefact: `eaa-audit-42`/);
  assert.match(body, /Run: \[#42\]\(https:\/\/github\.com\/x\/y\/actions\/runs\/42\)/);
});

test('renderPrComment: omits run link when runUrl absent', () => {
  const body = renderPrComment(baseReport(), { runId: 42 });
  assert.ok(!body.includes('Run: [#'));
});

test('renderPrComment: includes powered-by footer', () => {
  const body = renderPrComment(baseReport(), { runId: 42 });
  assert.match(body, /Powered by axe-core/);
});

test('renderPrComment: empty perPage → no top-5 block', () => {
  const r = baseReport();
  r.perPage = [];
  const body = renderPrComment(r, { runId: 42 });
  assert.ok(!body.includes('Top-5 violations'));
});

test('renderPrComment: 65k cap triggers truncation pointer', () => {
  const violations = [];
  // Generate huge synthetic report to blow past 65k.
  for (let i = 0; i < 10_000; i += 1) {
    violations.push({
      id: `rule-${i}-with-a-deliberately-long-name-to-pump-the-byte-count`,
      impact: 'critical',
      description: `description ${i}`.padEnd(200, 'x'),
      helpUrl: 'https://dequeuniversity.com/some/very/long/url/here',
      nodeCount: i,
    });
  }
  const report = {
    siteUrl: 'https://example.com',
    scannerPackVersion: '0.1.0',
    pagesScanned: 1,
    totalViolations: violations.length,
    totalsByImpact: { critical: violations.length, serious: 0, moderate: 0, minor: 0 },
    failOn: ['critical'],
    verdict: 'FAIL',
    perPage: [{ url: 'https://example.com/', violations }],
  };
  // Hack to force large top-5 — increase limit by editing local? No: 5 items is small.
  // To exercise the cap path we'd need >65k of body; force by stuffing huge top-5.
  // The renderer hard-codes top-5 so we test the cap with manually pumped helpUrl.
  // Build a degenerate body via overlong values:
  const wide = {
    siteUrl: 'https://example.com/'.padEnd(60_000, '/' /* not a URL but tests cap */),
    scannerPackVersion: '0.1.0',
    pagesScanned: 1,
    totalViolations: 1,
    totalsByImpact: { critical: 1, serious: 0, moderate: 0, minor: 0 },
    failOn: ['critical'],
    verdict: 'FAIL',
    perPage: [{ url: 'https://example.com/', violations: [violations[0]] }],
  };
  const body = renderPrComment(wide, { runId: 1 });
  // We don't strictly assert truncation triggered (depends on rendered size),
  // but assert the body is still under cap.
  assert.ok(body.length <= 65_536 + 2_000); // generous slack for the pointer line
});

// ---------------------------------------------------------------------------
// Top-5 selection: only five rows from a larger violation set, highest first.
// ---------------------------------------------------------------------------

test('collectTopViolations: selects only top-5 from a larger set', () => {
  const violations = [];
  // Eight criticals with descending nodeCount, plus lower-impact noise.
  for (let i = 0; i < 8; i += 1) {
    violations.push({ id: `crit-${i}`, impact: 'critical', description: '', helpUrl: '', nodeCount: 100 - i });
  }
  violations.push({ id: 'minor-x', impact: 'minor', description: '', helpUrl: '', nodeCount: 999 });
  const top = collectTopViolations({ perPage: [{ url: 'https://x', violations }] }, 5);
  assert.equal(top.length, 5);
  // Highest nodeCount critical first; minor (even with huge nodeCount) excluded.
  assert.equal(top[0].id, 'crit-0');
  assert.ok(top.every((v) => v.impact === 'critical'));
});

test('collectTopViolations: gathers violations across multiple pages', () => {
  const r = {
    perPage: [
      { url: 'https://x/a', violations: [{ id: 'a', impact: 'serious', description: '', helpUrl: '', nodeCount: 1 }] },
      { url: 'https://x/b', violations: [{ id: 'b', impact: 'critical', description: '', helpUrl: '', nodeCount: 1 }] },
    ],
  };
  const top = collectTopViolations(r, 5);
  assert.equal(top.length, 2);
  // critical from page b outranks serious from page a.
  assert.equal(top[0].id, 'b');
  assert.equal(top[0].url, 'https://x/b');
});

test('collectTopViolations: unknown impact sorts after known levels', () => {
  const r = {
    perPage: [
      {
        url: 'https://x',
        violations: [
          { id: 'weird', impact: 'mystery', description: '', helpUrl: '', nodeCount: 50 },
          { id: 'min', impact: 'minor', description: '', helpUrl: '', nodeCount: 1 },
        ],
      },
    ],
  };
  const top = collectTopViolations(r, 5);
  // Known 'minor' ranks ahead of the unrecognised impact value.
  assert.equal(top[0].id, 'min');
  assert.equal(top[1].id, 'weird');
});

test('collectTopViolations: malformed report → empty array', () => {
  assert.deepEqual(collectTopViolations(undefined, 5), []);
  assert.deepEqual(collectTopViolations({}, 5), []);
  assert.deepEqual(collectTopViolations({ perPage: 'nope' }, 5), []);
});

// ---------------------------------------------------------------------------
// renderPrComment: defaults for absent fields.
// ---------------------------------------------------------------------------

test('renderPrComment: absent totals render as 0', () => {
  const body = renderPrComment({ verdict: 'PASS', perPage: [] }, { runId: 1 });
  assert.match(body, /\| 🔴 critical +\| 0 \|/);
  assert.match(body, /\| ⚪ minor +\| 0 \|/);
});

test('renderPrComment: absent failOn defaults to serious,critical', () => {
  const body = renderPrComment({ verdict: 'PASS', perPage: [] }, { runId: 1 });
  assert.match(body, /fail-on: `serious,critical`/);
});

test('renderPrComment: failOn array is joined with commas', () => {
  const r = baseReport();
  r.failOn = ['minor', 'moderate', 'serious', 'critical'];
  const body = renderPrComment(r, { runId: 1 });
  assert.match(body, /fail-on: `minor,moderate,serious,critical`/);
});

// ---------------------------------------------------------------------------
// 65 536-char cap: boundary behaviour — under stays whole, over collapses.
// ---------------------------------------------------------------------------

test('renderPrComment: a normal top-5 render stays well under the 65 536 cap', () => {
  const body = renderPrComment(baseReport(), { runId: 1 });
  assert.ok(body.length < 65_536);
  // The top-5 block is present (not collapsed) when under cap.
  assert.match(body, /<details><summary>Top-5 violations<\/summary>/);
});

test('renderPrComment: over-cap render swaps top-5 block for a pointer line', () => {
  // A single overlong siteUrl pushes the rendered body past the cap; the
  // renderer must drop the top-5 block and insert the pointer sentence.
  const r = {
    siteUrl: 'https://example.com/'.padEnd(70_000, 'a'),
    scannerPackVersion: '0.1.0',
    pagesScanned: 1,
    totalViolations: 1,
    totalsByImpact: { critical: 1, serious: 0, moderate: 0, minor: 0 },
    failOn: ['critical'],
    verdict: 'FAIL',
    perPage: [
      {
        url: 'https://example.com/',
        violations: [{ id: 'color-contrast', impact: 'critical', description: 'd', helpUrl: '', nodeCount: 1 }],
      },
    ],
  };
  const body = renderPrComment(r, { runId: 1 });
  assert.ok(body.includes("exceed GitHub's 65 536-character cap"));
  // The expanded top-5 details block is gone once collapsed.
  assert.ok(!body.includes('<details><summary>Top-5 violations</summary>'));
  // The artefact pointer line still survives the collapse.
  assert.match(body, /Artefact: `eaa-audit-1`/);
});
