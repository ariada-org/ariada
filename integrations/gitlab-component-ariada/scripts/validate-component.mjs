// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile } from 'node:fs/promises';

const file = new URL('../templates/ariada.yml', import.meta.url);
const text = await readFile(file, 'utf8');

const required = [
  /^spec:\s*$/m,
  /^\s+inputs:\s*$/m,
  /^\s+target-url:\s*$/m,
  /^\s+fail-on-severity:\s*$/m,
  /^\s+output-format:\s*$/m,
  /^---\s*$/m,
  /^ariada_accessibility_gate:\s*$/m,
  /^\s+reports:\s*$/m,
  /^\s+codequality:/m,
  /^\s+junit:/m,
];

const missing = required.filter((pattern) => !pattern.test(text));
if (missing.length > 0) {
  console.error(`GitLab component shape validation failed: ${missing.length} required pattern(s) missing`);
  process.exit(1);
}

console.log('GitLab component shape OK: spec.inputs, job, and report artifacts present.');
