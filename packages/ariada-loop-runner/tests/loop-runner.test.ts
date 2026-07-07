// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runSelfRegulatingLoop, writeLoopFactsJsonl } from '../src/index.js';

let tmpDir: string | undefined;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
});

function writeFailingFixture(): string {
  tmpDir = mkdtempSync(join(tmpdir(), 'ariada-loop-runner-'));
  const file = join(tmpDir, 'public-note.md');
  const hiddenPath = ['product', 'plans', 'draft.md'].join('/');
  writeFileSync(file, `Release note must not cite ${hiddenPath} in public output.\n`, 'utf8');
  return file;
}

describe('runSelfRegulatingLoop', () => {
  it('turns a real Clamper fail into attribution, remediation and a loop fact', async () => {
    const filePath = writeFailingFixture();

    const result = await runSelfRegulatingLoop({
      filePaths: [filePath],
      commit: {
        sha: 'abc1234deadbeef',
        authorName: 'Alexander Brichkin',
        authorEmail: 'git@ariada.org',
        timestampUtc: '2026-07-04T09:00:00.000Z',
        message: 'docs: update public note',
      },
    });

    expect(result.gate.hasFailure).toBe(true);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]?.attribution.commitSha).toBe('abc1234deadbeef');
    expect(result.facts[0]?.attribution.author.name).toBe('Alexander Brichkin');
    expect(result.facts[0]?.attribution.posterior.length).toBeGreaterThan(0);
    expect(result.facts[0]?.remediation.branchName).toMatch(/^reverter\/fix-/);
    expect(result.facts[0]?.remediation.prTitle.length).toBeGreaterThan(0);
    expect(result.facts[0]?.remediation.prBody).toContain('draft PR');
  });

  it('records loop facts as deterministic JSONL for downstream readers', async () => {
    const filePath = writeFailingFixture();
    const result = await runSelfRegulatingLoop({
      filePaths: [filePath],
      commit: {
        sha: 'abc1234deadbeef',
        authorName: 'Alexander Brichkin',
        authorEmail: 'git@ariada.org',
        timestampUtc: '2026-07-04T09:00:00.000Z',
        message: 'docs: update public note',
      },
    });
    const outputPath = join(tmpDir ?? '', 'loop-facts.jsonl');

    const written = writeLoopFactsJsonl(result.facts, outputPath);

    expect(written).toBe(1);
    const lines = readFileSync(outputPath, 'utf8').trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    const recorded = JSON.parse(lines[0] ?? '{}') as { kind?: string; schemaVersion?: number };
    expect(recorded).toMatchObject({
      kind: 'content-policy-loop-fact',
      schemaVersion: 1,
    });
  });
});
