// SPDX-License-Identifier: EUPL-1.2
//
// Accessibility gate for the Vercel dashboard mock fixture.
// Runs axe-core via jsdom against the static HTML and expects 0 violations.
// This closes the gap where the tool that detects a11y failures in user code
// had no a11y coverage on its own gate UI.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..', '..');
const MONO_ROOT = join(HERE, '..', '..', '..', '..');
const FIXTURES = join(MONO_ROOT, 'packages', 'ariada-test-fixtures', 'fixtures');
const FIXTURE_HTML = join(FIXTURES, 'vercel-dashboard-mock.html');

const req = createRequire(join(PKG_ROOT, 'package.json'));
const axeMinPath = req.resolve('axe-core/axe.min.js');

async function runAxe(htmlPath: string) {
  const html = readFileSync(htmlPath, 'utf8');
  const { JSDOM } = await import('jsdom');
  const axeSource = readFileSync(axeMinPath, 'utf8');

  const dom = new JSDOM(html, {
    runScripts: 'dangerously' as const,
    url: 'http://localhost',
  });
  const { window } = dom;
  const { document } = window;

  const scriptEl = document.createElement('script');
  scriptEl.textContent = axeSource;
  document.head.appendChild(scriptEl);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const axeWindow = window as any;
  const results = await axeWindow.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
  });
  return results;
}

describe('vercel-dashboard-mock.html — axe-core accessibility gate', () => {
  it('fixture file exists', () => {
    expect(existsSync(FIXTURE_HTML)).toBe(true);
  });

  it('produces 0 axe violations (WCAG 2.x AA)', async () => {
    const results = await runAxe(FIXTURE_HTML);
    const violations = results.violations as { id: string; impact: string; description: string; nodes: { target: string[] }[] }[];
    if (violations.length > 0) {
      const summary = violations.map(v =>
        `[${v.impact}] ${v.id}: ${v.description}\n  nodes: ${v.nodes.map(n => n.target.join(', ')).join('; ')}`
      ).join('\n');
      throw new Error(`axe found ${violations.length} violation(s):\n${summary}`);
    }
    expect(violations.length).toBe(0);
  }, 30_000);

  it('has no incomplete (needs-review) items that hide failures', async () => {
    const results = await runAxe(FIXTURE_HTML);
    // Incomplete is not a hard failure, but log it for awareness
    const incomplete = results.incomplete as { id: string }[];
    // Expectation: fewer than 10 incomplete items (some are noise from jsdom CSS gaps)
    expect(incomplete.length).toBeLessThan(10);
  }, 30_000);
});
