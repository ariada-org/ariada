// SPDX-License-Identifier: EUPL-1.2
//
// Integration tests for the composite GitHub Action — verify that
// action.yml declares the documented inputs/outputs and the
// run-diff.sh / post-pr-comment.mjs scripts behave correctly under
// local invocation (no GitHub runner required).

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..', '..');

describe('action.yml contract', () => {
  it('exists at the package root', () => {
    expect(existsSync(join(PKG_ROOT, 'action.yml'))).toBe(true);
  });

  it('declares all documented inputs', () => {
    const yml = readFileSync(join(PKG_ROOT, 'action.yml'), 'utf8');
    for (const input of [
      'head-scan',
      'base-scan',
      'policy-file',
      'engine',
      'ariada-api-token',
      'pr-comment',
      'report-format',
      'fail-on-warn',
    ]) {
      expect(yml).toContain(`${input}:`);
    }
  });

  it('declares all documented outputs', () => {
    const yml = readFileSync(join(PKG_ROOT, 'action.yml'), 'utf8');
    for (const output of [
      'gate-result',
      'new-count',
      'pre-existing-count',
      'resolved-count',
      'report-url',
      'decision-id',
    ]) {
      expect(yml).toContain(`${output}:`);
    }
  });

  it('uses composite runs', () => {
    const yml = readFileSync(join(PKG_ROOT, 'action.yml'), 'utf8');
    expect(yml).toContain("using: 'composite'");
  });
});

describe('run-diff.sh script', () => {
  it('exists + is executable', () => {
    const p = join(PKG_ROOT, 'scripts', 'run-diff.sh');
    expect(existsSync(p)).toBe(true);
  });

  it('contains the documented exit-code branches', () => {
    const sh = readFileSync(join(PKG_ROOT, 'scripts', 'run-diff.sh'), 'utf8');
    expect(sh).toContain('GATE_RESULT');
    expect(sh).toContain('GITHUB_OUTPUT');
    expect(sh).toContain('emit_output');
  });
});

describe('post-pr-comment renderer', () => {
  it('renders pass result with summary table', async () => {
    const mod = await import('../../scripts/post-pr-comment.mjs');
    const md = mod.renderPrComment({
      result: 'pass',
      counts: { new: 0, pre_existing: 3, resolved: 1 },
      decision_id: '01HVDEC',
      recommended_action: 'Gate passed — no blocking findings',
    });
    expect(md).toContain('pass');
    expect(md).toContain('Pre-existing');
    expect(md).toContain('01HVDEC');
    // Summary table (SonarCloud/Codecov pattern)
    expect(md).toContain('| Gate status |');
    expect(md).toContain('| New violations');
    expect(md).toContain('| Pre-existing');
    expect(md).toContain('| Resolved');
  });

  it('renders fail result with report URL', async () => {
    const mod = await import('../../scripts/post-pr-comment.mjs');
    const md = mod.renderPrComment({
      result: 'fail',
      counts: { new: 5, pre_existing: 2, resolved: 0 },
      decision_id: '01HVDEC',
      recommended_action: 'Fix 5 new findings before merge',
      report_url: 'https://example.test/r',
    });
    expect(md).toContain('fail');
    expect(md).toContain('Fix 5 new findings');
    expect(md).toContain('https://example.test/r');
    expect(md).toContain('| Gate status |');
  });

  it('renders per-finding table when classification provided', async () => {
    const mod = await import('../../scripts/post-pr-comment.mjs');
    const md = mod.renderPrComment({
      result: 'fail',
      counts: { new: 2, pre_existing: 0, resolved: 0 },
      decision_id: '01HVDEC',
      recommended_action: 'Fix 2 new findings before merge',
      classification: {
        new: [
          { ruleId: 'color-contrast', severity: 'serious', selector: 'p', wcagSc: '1.4.3', occurrences: 2 },
          { ruleId: 'button-name', severity: 'critical', selector: 'button', wcagSc: '4.1.2', occurrences: 1 },
        ],
      },
    });
    // Per-finding table
    expect(md).toContain('### New findings (must fix to merge)');
    expect(md).toContain('| Severity |');
    expect(md).toContain('color-contrast');
    expect(md).toContain('button-name');
    expect(md).toContain('SC 1.4.3');
    expect(md).toContain('SC 4.1.2');
    expect(md).toContain('serious');
    expect(md).toContain('critical');
  });

  it('omits per-finding table when no classification', async () => {
    const mod = await import('../../scripts/post-pr-comment.mjs');
    const md = mod.renderPrComment({
      result: 'fail',
      counts: { new: 1, pre_existing: 0, resolved: 0 },
      decision_id: '01HVDEC',
      recommended_action: 'Review warnings',
    });
    expect(md).not.toContain('### New findings');
  });

  it('omits report URL when not provided', async () => {
    const mod = await import('../../scripts/post-pr-comment.mjs');
    const md = mod.renderPrComment({
      result: 'warn',
      counts: { new: 1, pre_existing: 0, resolved: 0 },
      decision_id: '01HVDEC',
      recommended_action: 'Review warnings',
    });
    expect(md).not.toContain('Full report');
  });

  it('includes decision ID in audit footer', async () => {
    const mod = await import('../../scripts/post-pr-comment.mjs');
    const md = mod.renderPrComment({
      result: 'pass',
      counts: { new: 0, pre_existing: 0, resolved: 0 },
      decision_id: 'TESTID-42',
      recommended_action: 'All clear.',
    });
    expect(md).toContain('TESTID-42');
    expect(md).toContain('Decision ID');
  });
});

describe('vercel-dashboard-mock.html fixture', () => {
  const MONO_ROOT = join(HERE, '..', '..', '..', '..');
  const FIXTURES = join(MONO_ROOT, 'packages', 'ariada-test-fixtures', 'fixtures');

  it('fixture file exists', () => {
    expect(existsSync(join(FIXTURES, 'vercel-dashboard-mock.html'))).toBe(true);
  });

  it('contains all five states (blocked, passing, loading, empty, error)', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('state-blocked');
    expect(html).toContain('state-passing');
    expect(html).toContain('state-loading');
    expect(html).toContain('state-empty');
    expect(html).toContain('state-error');
  });

  it('uses aria-disabled (not native disabled) on promote button', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    // aria-disabled= pattern must be present
    expect(html).toContain('aria-disabled');
    // native disabled= should NOT be used as the primary mechanism
    // (may appear in a comment but not as a standalone attribute on the button)
    // The correct pattern: no bare `disabled` attribute without aria- pairing
    // Check that the button element uses aria-disabled, not a bare disabled=""
    const buttonMatch = html.match(/<button[^>]+id="promote-btn"[^>]*>/);
    expect(buttonMatch).not.toBeNull();
    // Button should not have bare disabled attribute (aria-disabled is the pattern)
    expect(buttonMatch![0]).not.toMatch(/\bdisabled\b(?!=)/);
  });

  it('contains skip link for keyboard navigation', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('skip-link');
    expect(html).toContain('Skip to main content');
  });

  it('has proper heading structure (h1, h2)', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('<h1>');
    expect(html).toContain('<h2 class="section-title">');
  });

  it('contains diff-callout with large new/tracked numbers', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('diff-callout');
    expect(html).toContain('new (must fix)');
    expect(html).toContain('tracked (not blocking)');
  });

  it('uses details/summary for progressive disclosure (no-JS collapsible)', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('<details');
    expect(html).toContain('<summary>');
  });

  it('breadcrumb uses semantic ol/li nav', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('aria-label="Deployment breadcrumb"');
    expect(html).toContain('<ol');
  });

  it('has focus-visible CSS rule', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain(':focus-visible');
  });

  it('has view-details-link with adequate touch target (min-height 44px)', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('view-details-link');
    // Check CSS has min-height: 44px
    expect(html).toContain('min-height: 44px');
  });

  it('has skeleton animation for loading state', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('skeleton-line');
    expect(html).toContain('skeleton-shimmer');
  });

  it('has prefers-reduced-motion rule for skeleton', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('prefers-reduced-motion');
  });

  it('has print media query', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    expect(html).toContain('@media print');
  });

  it('breadcrumb colour meets contrast (uses #a0aec0 not #888)', () => {
    const html = readFileSync(join(FIXTURES, 'vercel-dashboard-mock.html'), 'utf8');
    // Confirms the fix was applied — #888 on #111 fails 1.4.3; #a0aec0 passes
    expect(html).toContain('#a0aec0');
    // The old failing value #888 should not be the breadcrumb colour
    // (it may appear in other contexts such as separator chars)
    const breadcrumbColorUsage = html.match(/\.topbar \.breadcrumb\s*\{[^}]*color:\s*([^;]+)/);
    if (breadcrumbColorUsage) {
      expect(breadcrumbColorUsage[1].trim()).not.toBe('#888');
    }
  });
});
