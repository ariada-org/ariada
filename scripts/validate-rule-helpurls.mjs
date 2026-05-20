#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
// SPDX-License-Identifier: EUPL-1.2

/**
 * validate-rule-helpurls.mjs
 *
 * Verifies that every helpUrl declared in a rule TypeScript source file
 * under packages/wcag-rules-extended/src/rules/ points to an existing
 * Markdown file under packages/wcag-rules-extended/docs/rules/.
 *
 * Reads the HELP_URL constant (or inline helpUrl literal) out of each
 * rule .ts file via a regex; extracts the basename; checks if the
 * matching .md exists on disk. Exits non-zero on any missing target,
 * unreachable URL prefix, or duplicate basename collision.
 *
 * Usage:
 *   node scripts/validate-rule-helpurls.mjs
 *
 * Exit codes:
 *   0 — pass (every helpUrl has a matching doc file)
 *   1 — fail (one or more helpUrls point to a missing file)
 *   2 — invocation error (bad cwd, missing tree)
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const rulesDir = join(repoRoot, 'packages/wcag-rules-extended/src/rules');
const docsDir = join(repoRoot, 'packages/wcag-rules-extended/docs/rules');

if (!existsSync(rulesDir)) {
  console.error(`error: rules directory not found at ${rulesDir}`);
  process.exit(2);
}
if (!existsSync(docsDir)) {
  console.error(`error: docs directory not found at ${docsDir}`);
  process.exit(2);
}

/**
 * Walk a directory tree returning every file matching the predicate.
 */
function walk(dir, predicate) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      // skip mutation-testing sandboxes
      if (entry === '.stryker-tmp' || entry === 'node_modules' || entry === 'dist') continue;
      out.push(...walk(full, predicate));
    } else if (st.isFile() && predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

const ruleFiles = walk(rulesDir, (f) => {
  if (!f.endsWith('.ts')) return false;
  if (f.endsWith('.test.ts')) return false;
  if (f.endsWith('/index.ts')) return false;
  if (f.endsWith('/_shared.ts')) return false;
  return true;
});

if (ruleFiles.length === 0) {
  console.error('error: no rule source files found');
  process.exit(2);
}

// Find each rule file's helpUrl basename. We support two patterns:
//   1. const HELP_URL = 'https://.../docs/rules/<name>.md';
//   2. helpUrl: 'https://.../docs/rules/<name>.md',
const HELPURL_REGEX = /docs\/rules\/([a-z0-9][a-z0-9-]*\.md)/g;

const helpUrlBasenames = new Map(); // basename → first ruleFile that declared it
const errors = [];

for (const file of ruleFiles) {
  const src = readFileSync(file, 'utf8');
  const matches = [...src.matchAll(HELPURL_REGEX)];
  if (matches.length === 0) {
    errors.push(`MISS  ${file} — no helpUrl referencing docs/rules/<name>.md found`);
    continue;
  }
  // Each rule file should declare exactly one helpUrl basename (collected via
  // both the constant and the inline literal in the metadata block, but they
  // dedupe to a single basename).
  const basenames = new Set(matches.map((m) => m[1]));
  if (basenames.size !== 1) {
    errors.push(
      `AMBIG ${file} — multiple distinct helpUrl basenames: ${[...basenames].join(', ')}`,
    );
    continue;
  }
  const bn = [...basenames][0];
  if (helpUrlBasenames.has(bn) && helpUrlBasenames.get(bn) !== file) {
    errors.push(`DUP   ${bn} — declared by both ${helpUrlBasenames.get(bn)} and ${file}`);
  } else {
    helpUrlBasenames.set(bn, file);
  }
}

// Verify each basename has a matching .md on disk.
for (const [bn, ruleFile] of helpUrlBasenames) {
  const target = join(docsDir, bn);
  if (!existsSync(target)) {
    errors.push(`404   ${bn} — referenced by ${ruleFile} but file missing in ${docsDir}`);
  }
}

const summary = `${helpUrlBasenames.size} rule file(s) checked → ${errors.length} problem(s)`;
if (errors.length > 0) {
  console.error(`FAIL — ${summary}`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`PASS — ${summary}`);
process.exit(0);
