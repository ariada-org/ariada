// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runGate } from '../src/cli.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'content-gate-test-'));
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmp(name: string, content: string): string {
  const p = join(tmpDir, name);
  writeFileSync(p, content, 'utf8');
  return p;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runGate — internal-leak fixture → fail', () => {
  it('detects a commercial-domain leak and sets hasFailure', () => {
    const file = writeTmp('leak.md', 'Check ariada.ai for the Pro plan.');
    const result = runGate([file]);

    expect(result.hasFailure).toBe(true);
    const verdict = result.verdicts[0];
    expect(verdict).toBeDefined();
    expect(verdict!.decision.result).toBe('fail');
    expect(verdict!.decision.counts.fail).toBeGreaterThan(0);
    expect(verdict!.decision.findings.some((f) => f.category === 'commercial-crosspromo')).toBe(true);
  });

  it('detects an internal path leak and sets hasFailure', () => {
    const file = writeTmp('path-leak.md', 'see product/plans/my-secret-prd.md for detail');
    const result = runGate([file]);

    expect(result.hasFailure).toBe(true);
    expect(result.verdicts[0]!.decision.result).toBe('fail');
    expect(result.verdicts[0]!.decision.findings.some((f) => f.category === 'internal-path')).toBe(true);
  });

  it('detects an agent codename and sets hasFailure', () => {
    const file = writeTmp('codename.ts', '// Author: GAUSS (orchestrator)');
    const result = runGate([file]);

    expect(result.hasFailure).toBe(true);
    expect(result.verdicts[0]!.decision.findings.some((f) => f.category === 'internal-codename')).toBe(true);
  });
});

describe('runGate — clean fixture → pass', () => {
  it('passes clean public-OSS content and clears hasFailure', () => {
    const file = writeTmp(
      'clean.md',
      [
        'Install with: npm install @ariada-org/cli',
        'This package targets WCAG 2.2 AA and EAA 2025.',
        'Licensed under EUPL-1.2.',
      ].join('\n'),
    );
    const result = runGate([file]);

    expect(result.hasFailure).toBe(false);
    expect(result.verdicts[0]!.decision.result).toBe('pass');
    expect(result.verdicts[0]!.decision.findings).toHaveLength(0);
  });

  it('returns hasFailure=false with all-pass multi-file batch', () => {
    const f1 = writeTmp('clean1.ts', '// A standard TypeScript source file.');
    const f2 = writeTmp('clean2.md', 'Run `pnpm test` to verify the suite.');
    const result = runGate([f1, f2]);

    expect(result.hasFailure).toBe(false);
    expect(result.verdicts).toHaveLength(2);
    for (const v of result.verdicts) {
      expect(v.decision.result).toBe('pass');
    }
  });
});

describe('runGate — mixed batch', () => {
  it('sets hasFailure=true even when only one file in a batch fails', () => {
    const clean = writeTmp('mix-clean.md', 'No secrets here.');
    const dirty = writeTmp('mix-dirty.md', 'See /Users/example/project/secret.json');
    const result = runGate([clean, dirty]);

    expect(result.verdicts).toHaveLength(2);
    expect(result.hasFailure).toBe(true);

    const dirtyVerdict = result.verdicts.find((v) => v.filePath.includes('mix-dirty'));
    expect(dirtyVerdict?.decision.result).toBe('fail');

    const cleanVerdict = result.verdicts.find((v) => v.filePath.includes('mix-clean'));
    expect(cleanVerdict?.decision.result).toBe('pass');
  });
});
