// SPDX-License-Identifier: EUPL-1.2
// Accessibility gate: run axe-core against an HTML file via jsdom.
// Usage: node scripts/axe-check.mjs <path-to-html>
// Exit: 0 = 0 violations; 1 = violations found; 2 = error

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(HERE, '..');

// Resolve axe.min.js from the local hoisted pnpm store
const req = createRequire(join(PKG_ROOT, 'package.json'));
const axeMinPath = req.resolve('axe-core/axe.min.js');

const htmlFile = process.argv[2];
if (!htmlFile) {
  console.error('Usage: node axe-check.mjs <path-to-html>');
  process.exit(2);
}

// The HTML path comes from the command line, so confine it to the current
// working directory: a canonicalized path that escapes the base dir (via `..`
// or an absolute path elsewhere) is rejected before any file read.
const baseDir = resolve(process.cwd());
const resolvedHtml = resolve(baseDir, htmlFile);
const rel = relative(baseDir, resolvedHtml);
if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
  console.error(`Refusing to read outside the working directory: ${htmlFile}`);
  process.exit(2);
}
if (!existsSync(resolvedHtml)) {
  console.error('Usage: node axe-check.mjs <path-to-html>');
  process.exit(2);
}

// resolvedHtml is confined to baseDir by the path.relative containment check
// above (rejects `..` traversal and absolute paths). NOSONAR: validated path.
const html = readFileSync(resolvedHtml, 'utf8'); // NOSONAR
const { JSDOM } = await import('jsdom');
const axeSource = readFileSync(axeMinPath, 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost',
});

const { window } = dom;
const { document } = window;

const scriptEl = document.createElement('script');
scriptEl.textContent = axeSource;
document.head.appendChild(scriptEl);

const results = await window.axe.run(document, {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
});

const violations = results.violations;
if (violations.length === 0) {
  console.log('axe: 0 violations ✅');
} else {
  console.log(`axe: ${violations.length} violation(s) ❌`);
  for (const v of violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
    for (const n of v.nodes) {
      console.log(`    node: ${n.target.join(', ')}`);
      if (n.failureSummary) {
        console.log(`    fix:  ${n.failureSummary.split('\n')[0]}`);
      }
    }
  }
}
process.exit(violations.length > 0 ? 1 : 0);
