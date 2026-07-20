// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import {
  builtinPacks,
  contentFingerprint,
  evaluateContent,
  ossSurfaceProfile,
} from '../src/index.js';

const run = (content: string) => evaluateContent(content, ossSurfaceProfile, builtinPacks);

describe('content-policy oss-surface profile — known-leak oracle (must FAIL)', () => {
  // These strings are the real literals the publish gate must catch. Each MUST
  // produce a fail verdict; this is the known-leak oracle.
  const leaks: Array<[string, string, string]> = [
    ['commercial domain', 'Check ariada.ai for the paid tier.', 'commercial-crosspromo'],
    ['commercial domain blamer', 'Try blamer.ai today', 'commercial-crosspromo'],
    ['USPTO app number', 'Provisional 64/000,000 filed 2026-03-18.', 'patent'],
    ['agent codename', 'Author: GAUSS (orchestrator)', 'internal-codename'],
    ['AI co-author trailer', 'Co-Authored-By: Claude <noreply@anthropic.com>', 'ai-authorship'],
    ['internal path', 'see product/plans/secret-prd.md', 'internal-path'],
    ['internal .claude path', 'configured in .claude/rules/foo.md', 'internal-path'],
    ['api key', 'token=sk-abcdefghij1234567890abcdef', 'secret'],
    ['github token', 'gho_ABCDEFGHIJ1234567890abcdefghij', 'secret'],
    ['founder home path', 'reads secret', 'internal-path'],
  ];

  for (const [name, content, category] of leaks) {
    it(`fails on ${name}`, () => {
      const d = run(content);
      expect(d.result).toBe('fail');
      expect(d.counts.fail).toBeGreaterThan(0);
      expect(d.findings.some((f) => f.category === category)).toBe(true);
    });
  }
});

describe('content-policy oss-surface profile — clean controls (must PASS)', () => {
  const clean = [
    'The core-engine package scans the DOM against WCAG 2.2 AA rules.',
    'Install with npm install @ariada-org/cli and run a scan.',
    'This project targets EAA 2025 and EN 301 549 compliance.',
    'Licensed under EUPL-1.2. Contributions welcome.',
  ];
  for (const content of clean) {
    it(`passes clean content: ${content.slice(0, 40)}…`, () => {
      const d = run(content);
      expect(d.result).toBe('pass');
      expect(d.findings).toHaveLength(0);
    });
  }

  it('allow-lists widely-known abbreviations even though present', () => {
    const d = run('WCAG and EAA and GDPR are referenced.');
    expect(d.result).toBe('pass');
  });
});

describe('mechanics', () => {
  it('content fingerprint is position-independent (for reverter baseline)', () => {
    // Same leak, different surrounding text/line → same fingerprint.
    const a = run('line one\nleak ariada.ai here');
    const b = run('ariada.ai at the very start');
    const fpA = a.findings.find((f) => f.category === 'commercial-crosspromo')?.fingerprint;
    const fpB = b.findings.find((f) => f.category === 'commercial-crosspromo')?.fingerprint;
    expect(fpA).toBeDefined();
    expect(fpA).toBe(fpB);
  });

  it('reports the correct line number', () => {
    const d = run('clean first line\nclean second\ntoken sk-abcdefghij1234567890abcd');
    expect(d.findings[0]?.line).toBe(3);
  });

  it('contentFingerprint is stable + 16 hex chars', () => {
    const fp = contentFingerprint('r', 'ariada.ai');
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(contentFingerprint('r', 'ARIADA.AI ')).toBe(fp); // case + trim normalized
  });

  it('warn action yields warn, not fail', () => {
    const profile = {
      id: 't',
      surface: 's',
      packs: ['p'],
    };
    const packs = [
      {
        id: 'p',
        description: '',
        rules: [{ id: 'w', description: '', action: 'warn' as const, category: 'c', patterns: ['todo'] }],
      },
    ];
    const d = evaluateContent('a todo here', profile, packs);
    expect(d.result).toBe('warn');
    expect(d.counts.warn).toBe(1);
  });
});
