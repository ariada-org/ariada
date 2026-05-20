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
  it('renders pass result', async () => {
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
});
