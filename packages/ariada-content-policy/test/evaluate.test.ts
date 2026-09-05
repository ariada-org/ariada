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
    ['a developer home path', 'reads /Users/example/project/secret', 'internal-path'],
    // A reference to a repository directory is relative, and stays caught. The
    // clean controls below hold the same names as website paths, which are not.
    ['a repository directory', 'see patents/draft-a/spec.md', 'internal-path'],
    ['a home-relative internal path', 'listed in ~/.claude/rules/x.md', 'internal-path'],
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
    // Pages on the published site. They carry the same words as three internal
    // directories, and the only thing telling them apart is the leading slash:
    // a repository path is relative, a page address is not. Before the rule
    // knew that, it refused the page list of the workflow that scans the site,
    // and a transfer carrying an unrelated fix to that workflow could not
    // travel. All three addresses answer today.
    '/,/about/,/patents/,/packages/,/legal/patent-peace/',
    'The scan covers https://ariada.org/patents/ among other pages.',
    'Grant terms are summarised at /grants/ on the site.',
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

describe('content-policy no-secrets pack — base64/hex blob false-positive fix', () => {
  // Real bug: a screenshot embedded inline as `data:image/png;base64,...` in a
  // scan-evidence report can, by chance, contain a 20-char run that matches
  // the AWS-key shape (`AKIA` + 16 alphanumerics) — the AWS pattern has no
  // notion of "this is the middle of an unrelated binary blob". The fix must
  // suppress matches embedded in a long encoded run without weakening
  // detection of a real, word-boundaried credential.

  it('does NOT flag an AWS-key-shaped substring embedded in a data:image/png;base64 payload', () => {
    // Mirrors a real scan-evidence result.html: a huge inline base64 PNG
    // where an incidental 20-char run happens to look like an AWS key.
    const longRun =
      'iVBORw0KGgoAAAANSUhEUgAABaAAAAZACAIAAAAAbnKAAAAQAElEQVR4nOydBVgVWRvHRwnpEEFQMBEVBLEbEcECO9bWtbu71' +
      'A'.repeat(200) +
      'AKIAPMNH83BJZB1R9FBT' +
      'B'.repeat(200) +
      '==';
    const content = `<figure><img src="data:image/png;base64,${longRun}" alt="scan result"></figure>`;
    const d = run(content);
    expect(d.findings.some((f) => f.category === 'secret')).toBe(false);
  });

  it('does NOT flag an AWS-key-shaped substring embedded in a long hex run (e.g. a hash blob)', () => {
    const hexRun = '0123456789abcdef'.repeat(20) + 'AKIAABCDEFGHIJKLMNO' + '0123456789abcdef'.repeat(20);
    const d = run(`checksum: ${hexRun}`);
    expect(d.findings.some((f) => f.category === 'secret')).toBe(false);
  });

  it('still flags a real standalone AWS access key (must not weaken true positives)', () => {
    const d = run('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
    expect(d.result).toBe('fail');
    expect(
      d.findings.some((f) => f.category === 'secret' && f.matchedText === 'AKIAIOSFODNN7EXAMPLE'),
    ).toBe(true);
  });

  it('still flags a real standalone OpenAI-shaped key quoted in JSON', () => {
    const d = run('{"OPENAI_API_KEY": "sk-abcdefghij1234567890abcdef"}');
    expect(d.result).toBe('fail');
    expect(d.findings.some((f) => f.category === 'secret')).toBe(true);
  });

  it('still flags a real standalone GitHub token adjacent to other prose', () => {
    const d = run('leaked in CI logs: gho_ABCDEFGHIJ1234567890abcdefghij (rotate immediately)');
    expect(d.result).toBe('fail');
    expect(d.findings.some((f) => f.category === 'secret')).toBe(true);
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
