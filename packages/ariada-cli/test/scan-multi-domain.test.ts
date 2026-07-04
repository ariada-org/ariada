// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import type {
  DomainModule,
  MultiDomainReport,
  PropertySnapshot,
  UnifiedSnapshot,
} from '@ariada-org/core-engine';
import {
  discoverDomains,
  runMultiDomainScan as runCoreMultiDomainScan,
} from '@ariada-org/core-engine';
import { describe, it, expect } from 'vitest';

import { EXIT_OK, EXIT_VIOLATIONS, EXIT_INVALID_ARGS } from '../src/exit-codes.js';
import { runMultiDomainScan } from '../src/subcommands/scan-multi-domain.js';

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

function makeUnified(url: string): UnifiedSnapshot {
  return {
    scanId: `scan-${url}`,
    url,
    timestamp: 0,
    axTree: [],
    domOutline: [{ backendNodeId: 1, nodeName: 'img', selector: 'img.hero' }],
    perfMetrics: {},
    networkResources: [],
    timings: { navigationMs: 0, axTreeMs: 0, domMs: 0, totalMs: 0 },
  };
}

const oneDomain: DomainModule = {
  id: 'accessibility',
  title: 'Accessibility',
  version: '0',
  extractors: {},
  evaluate: () => [],
};

/** A scan stub that flags the first site and passes the second. */
function divergingScan(input: {
  snapshots: readonly PropertySnapshot[];
  domains: readonly DomainModule[];
}): Promise<MultiDomainReport> {
  const [a, b] = input.snapshots;
  const finding = {
    id: 'image-alt-img.hero',
    scanId: a?.scanId ?? '',
    domain: 'accessibility' as const,
    ruleId: 'image-alt',
    severity: 'serious' as const,
    element: { selector: 'img.hero' },
    message: 'Image is missing alternative text',
  };
  return Promise.resolve({
    sites: [a?.url ?? '', b?.url ?? ''],
    domains: ['accessibility'],
    grid: {
      [a?.url ?? '']: { accessibility: [finding] },
      [b?.url ?? '']: { accessibility: [] },
    },
    interactions: [],
    crossSite: {
      systemic: [],
      divergence: [
        {
          domain: 'accessibility',
          ruleId: 'image-alt',
          failingSites: [a?.url ?? ''],
          passingSites: [b?.url ?? ''],
        },
      ],
    },
  });
}

const stubs = {
  capture: (url: string): Promise<UnifiedSnapshot> => Promise.resolve(makeUnified(url)),
  discover: (): Promise<DomainModule[]> => Promise.resolve([oneDomain]),
  scan: divergingScan,
};

describe('runMultiDomainScan — argument validation', () => {
  it('rejects an empty URL list', async () => {
    const b = buffers();
    const code = await runMultiDomainScan([], { domains: ['accessibility'] }, b.stdout, b.stderr);
    expect(code).toBe(EXIT_INVALID_ARGS);
  });

  it('rejects a non-http(s) URL', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['ftp://x/'],
      { domains: ['accessibility'] },
      b.stdout,
      b.stderr,
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
  });

  it('rejects an unknown --format', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['accessibility'], format: 'xml' as unknown as 'human' },
      b.stdout,
      b.stderr,
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
  });
});

describe('runMultiDomainScan — rendering', () => {
  it('renders the grid and the divergence, exiting with violations', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['http://brand.com/', 'http://brand.de/'],
      { domains: ['accessibility'], format: 'human' },
      b.stdout,
      b.stderr,
      stubs,
    );
    expect(code).toBe(EXIT_VIOLATIONS);
    const out = b.out();
    expect(out).toContain('ariada multi-domain scan');
    expect(out).toContain('http://brand.com/');
    expect(out).toContain('1 found');
    expect(out).toContain('pass');
    expect(out).toContain('divergence');
  });

  it('writes a static HTML report with grid, divergence and interactions', async () => {
    const b = buffers();
    const dir = await mkdtemp(join(tmpdir(), 'ariada-multi-domain-html-'));
    const outputFile = join(dir, 'demo-report.html');
    const reportWithInteraction = (input: {
      snapshots: readonly PropertySnapshot[];
      domains: readonly DomainModule[];
    }): Promise<MultiDomainReport> =>
      divergingScan(input).then((report) => ({
        ...report,
        domains: ['accessibility', 'sustainability'],
        grid: {
          [report.sites[0] ?? '']: {
            accessibility: report.grid[report.sites[0] ?? '']?.['accessibility'] ?? [],
            sustainability: [],
          },
          [report.sites[1] ?? '']: {
            accessibility: [],
            sustainability: [],
          },
        },
        interactions: [
          {
            id: 'scan-0:accessibility-sustainability:img.hero',
            type: 'conflict',
            domains: ['accessibility', 'sustainability'],
            elementKey: 'img.hero',
            predictedEffect:
              'Compressing this image can change the visual fidelity its alt text describes.',
            confidence: 0.91,
          },
        ],
      }));

    try {
      const code = await runMultiDomainScan(
        ['http://brand.com/', 'http://brand.de/'],
        { domains: ['accessibility'], format: 'html', outputFile },
        b.stdout,
        b.stderr,
        { ...stubs, scan: reportWithInteraction },
      );
      expect(code).toBe(EXIT_VIOLATIONS);
      expect(b.out()).toContain(`Wrote ${outputFile}`);
      const html = await readFile(outputFile, 'utf8');
      expect(html).toContain('<title>Ariada multi-domain demo report</title>');
      expect(html).toContain('Site x domain grid');
      expect(html).toContain('Cross-site divergence');
      expect(html).toContain('Cross-domain interaction');
      expect(html).toContain('accessibility &lt;-&gt; sustainability');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('runs the offline fixture demo through the real core scan', async () => {
    const b = buffers();
    const dir = await mkdtemp(join(tmpdir(), 'ariada-real-fixture-demo-'));
    const outputFile = join(dir, 'demo-report.html');
    const fixtures = [
      new URL('../../ariada-test-fixtures/fixtures/cross-site-failing.html', import.meta.url).href,
      new URL('../../ariada-test-fixtures/fixtures/cross-site-passing.html', import.meta.url).href,
    ];
    let report: MultiDomainReport | undefined;

    try {
      const code = await runMultiDomainScan(
        fixtures,
        {
          domains: ['accessibility', 'sustainability', 'privacy'],
          format: 'html',
          outputFile,
          severityThreshold: 'critical',
        },
        b.stdout,
        b.stderr,
        {
          discover: () => Promise.resolve(discoverDomains({})),
          scan: async (input) => {
            report = await runCoreMultiDomainScan(input);
            return report;
          },
        },
      );
      expect(code).toBe(EXIT_OK);
      expect(report).toBeDefined();
      expect(report?.sites).toHaveLength(2);
      expect(report?.domains).toEqual(['accessibility', 'privacy', 'sustainability']);
      for (const site of report?.sites ?? []) {
        for (const domain of report?.domains ?? []) {
          expect(Array.isArray(report?.grid[site]?.[domain])).toBe(true);
        }
      }
      expect(report?.crossSite.divergence.length).toBeGreaterThanOrEqual(1);
      expect(report?.interactions.length).toBeGreaterThanOrEqual(1);
      expect(await readFile(outputFile, 'utf8')).toContain('Cross-domain interaction');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exits OK when no site has findings', async () => {
    const b = buffers();
    const cleanScan = (): Promise<MultiDomainReport> =>
      Promise.resolve({
        sites: ['http://a.local/'],
        domains: ['accessibility'],
        grid: { 'http://a.local/': { accessibility: [] } },
        interactions: [],
        crossSite: { systemic: [], divergence: [] },
      });
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['accessibility'], format: 'human' },
      b.stdout,
      b.stderr,
      { ...stubs, scan: cleanScan },
    );
    expect(code).toBe(EXIT_OK);
  });

  it('errors when no requested domain is discovered', async () => {
    const b = buffers();
    const code = await runMultiDomainScan(
      ['http://a.local/'],
      { domains: ['nonexistent'], format: 'human' },
      b.stdout,
      b.stderr,
      stubs,
    );
    expect(code).toBe(EXIT_INVALID_ARGS);
  });
});
