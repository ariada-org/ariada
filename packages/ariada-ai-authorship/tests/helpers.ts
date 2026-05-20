// SPDX-License-Identifier: EUPL-1.2
//
// Test helpers — minimal builders so individual tests stay focused on
// the property under examination.

import { createHash } from 'node:crypto';

import type { AttributionInput, CommitMetadata } from '../src/types.js';

const SAMPLE_CODE = `
function add(a: number, b: number): number {
  return a + b;
}

function multiply(left: number, right: number): number {
  return left * right;
}

export function compute(items: number[]): number {
  return items.reduce((accumulator, current) => accumulator + current, 0);
}
`.trim();

const SAMPLE_DIFF = `@@ -0,0 +1,9 @@
+function add(a: number, b: number): number {
+  return a + b;
+}
+
+function multiply(left: number, right: number): number {
+  return left * right;
+}
`;

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sampleMetadata(
  overrides: Partial<CommitMetadata> = {},
): CommitMetadata {
  return {
    timestamp_utc: '2026-05-20T12:00:00.000Z',
    git_author_email: sha256('dev@example.com'),
    commit_message: 'feat: arithmetic helpers',
    prior_commit_timestamps: [
      '2026-05-20T11:55:00.000Z',
      '2026-05-20T11:50:00.000Z',
      '2026-05-20T11:45:00.000Z',
    ],
    ...overrides,
  };
}

export function sampleInput(
  overrides: Partial<AttributionInput> = {},
): AttributionInput {
  const base: AttributionInput = {
    code: SAMPLE_CODE,
    diff_unified: SAMPLE_DIFF,
    language: 'ts',
    commit_metadata: sampleMetadata(),
    file_path: 'src/arith.ts',
  };
  return { ...base, ...overrides };
}
