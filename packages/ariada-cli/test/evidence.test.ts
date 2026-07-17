// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import type { MultiDomainReport } from '@ariada-org/core-engine';
import { describe, expect, it } from 'vitest';

import { EXIT_OK } from '../src/exit-codes.js';
import { run } from '../src/parser.js';
import { runEvidenceExport } from '../src/subcommands/evidence.js';

function buffers(): {
  stdout: Writable;
  stderr: Writable;
  out: () => string;
  err: () => string;
} {
  const outChunks: Buffer[] = [];
  const errChunks: Buffer[] = [];
  return {
    stdout: new Writable({
      write(chunk: Buffer, _enc, cb) {
        outChunks.push(chunk);
        cb();
      },
    }),
    stderr: new Writable({
      write(chunk: Buffer, _enc, cb) {
        errChunks.push(chunk);
        cb();
      },
    }),
    out: () => Buffer.concat(outChunks).toString('utf8'),
    err: () => Buffer.concat(errChunks).toString('utf8'),
  };
}

function sampleReport(): MultiDomainReport {
  return {
    sites: ['fixture:a.html'],
    domains: ['accessibility'],
    grid: {
      'fixture:a.html': {
        accessibility: [
          {
            id: 'image-alt-img',
            scanId: 'scan-1',
            domain: 'accessibility',
            ruleId: 'image-alt',
            severity: 'serious',
            element: { selector: 'img.hero' },
            message: 'Image is missing alternative text',
            wcagMapping: ['1.1.1'],
          },
        ],
      },
    },
    interactions: [],
    crossSite: { systemic: [], divergence: [] },
  };
}

describe('ariada evidence', () => {
  it('writes deterministic VPAT HTML anchored to the current Git commit', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ariada-evidence-'));
    const input = join(dir, 'multi-domain-report.json');
    const first = join(dir, 'evidence-a.html');
    const second = join(dir, 'evidence-b.html');
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    await writeFile(input, `${JSON.stringify(sampleReport(), null, 2)}\n`, 'utf8');
    const b1 = buffers();
    const b2 = buffers();

    try {
      const code1 = await run(['evidence', input, '--format', 'vpat', '--out', first], {
        stdout: b1.stdout,
        stderr: b1.stderr,
      });
      const code2 = await run(['evidence', input, '--format', 'vpat', '--out', second], {
        stdout: b2.stdout,
        stderr: b2.stderr,
      });
      expect(code1).toBe(EXIT_OK);
      expect(code2).toBe(EXIT_OK);
      expect(await readFile(first, 'utf8')).toBe(await readFile(second, 'utf8'));
      const html = await readFile(first, 'utf8');
      expect(html).toContain(`true at commit ${head}`);
      expect(html).toContain('Auto-verified criteria');
      expect(html).toContain('Manual review required');
      expect(html).toContain('Regression attribution: candidate');
      expect(html).not.toMatch(/certified|guaranteed compliant/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('uses an injected signing hook without network access', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ariada-evidence-sign-'));
    const input = join(dir, 'multi-domain-report.json');
    const out = join(dir, 'evidence.html');
    await writeFile(input, `${JSON.stringify(sampleReport())}\n`, 'utf8');
    const b = buffers();

    try {
      const code = await runEvidenceExport(
        input,
        { format: 'en301549', out },
        b.stdout,
        b.stderr,
        {
          getHeadSha: async () => 'abc1234',
          sign: async (payload) => `signed:${payload.commitSha}:${payload.format}`,
        },
      );
      expect(code).toBe(EXIT_OK);
      const html = await readFile(out, 'utf8');
      expect(html).toContain('true at commit abc1234');
      expect(html).toContain('signed:abc1234:en301549');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
